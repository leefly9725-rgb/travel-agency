/*
 * Step 3 composer implementation.
 *
 * Preview and PDF must consume the same composed pages output.
 * Export must never perform second-pass pagination or reflow.
 */

(function () {
  // Negative tolerance: content must fit with 12px to spare.
  // Print-mode fonts can render 4-12px taller than screen-mode due to DPI differences.
  const PAGE_TOLERANCE = -12;

  function createPage(options) {
    const config = options || {};
    return {
      id: config.id || '',
      pageNo: Number(config.pageNo || 0),
      totalPages: Number(config.totalPages || 0),
      className: config.className || '',
      bodyClassName: config.bodyClassName || '',
      blocks: Array.isArray(config.blocks) ? config.blocks.slice() : [],
      footer: {
        left: config.footer && config.footer.left ? config.footer.left : '',
        right: config.footer && config.footer.right ? config.footer.right : '',
      },
    };
  }

  function createComposeState(options) {
    const config = options || {};
    return {
      pageHeight: Number(config.pageHeight || 0),
      bodyHeight: Number(config.bodyHeight || 0),
      pages: [],
      cursor: {
        pageIndex: 0,
        usedHeight: 0,
      },
      diagnostics: [],
    };
  }

  function getMeasureRoot() {
    const root = document.getElementById('qp-measure-root');
    if (!root) {
      throw new Error('Missing #qp-measure-root for quotation composer.');
    }
    return root;
  }

  function createMeasureBody(pageClassName, bodyClassName) {
    const root = getMeasureRoot();
    root.innerHTML = `
      <section class="qp-page ${pageClassName || ''} qp-measure-page">
        <div class="qp-page-inner">
          <div class="qp-page-body ${bodyClassName || ''}"></div>
          <div class="qp-page-footer"><span></span><span></span></div>
        </div>
      </section>
    `;
    return root.querySelector('.qp-page-body');
  }

  function setBodyHtml(bodyEl, blocks) {
    bodyEl.innerHTML = blocks.map((block) => block.html).join('');
  }

  // targetHeight: the fixed page body height captured before bodyEl was set to height:auto.
  // bodyEl.scrollHeight now reports actual content height (overflow:visible → scrollHeight
  // equals layout height of content). Compare against targetHeight for overflow detection.
  function fitsBlocks(bodyEl, blocks, targetHeight) {
    setBodyHtml(bodyEl, blocks);
    return bodyEl.scrollHeight <= targetHeight + PAGE_TOLERANCE;
  }

  function remainingHeight(bodyEl, blocks, targetHeight) {
    setBodyHtml(bodyEl, blocks);
    return Math.max(0, targetHeight - bodyEl.scrollHeight);
  }

  function composeFixedPage(section) {
    return [createPage({
      id: section.id,
      className: section.pageClassName,
      bodyClassName: section.bodyClassName,
      blocks: section.blocks,
      footer: section.footer,
    })];
  }

  function composeFlowPages(section) {
    const bodyEl = createMeasureBody(section.pageClassName, section.bodyClassName);

    // Capture the fixed page body height BEFORE setting height:auto.
    const pageBodyHeight = bodyEl.clientHeight;
    bodyEl.style.height = 'auto';

    _log('section=' + section.id, 'pageBodyHeight=' + pageBodyHeight,
      'leadBlocks=' + (section.leadBlocks || []).length,
      'sourceBlocks=' + (section.blocks || []).length);

    const leadBlocks = section.leadBlocks || [];
    const sourceBlocks = section.blocks || [];
    const pages = [];
    let currentBlocks = leadBlocks.slice();
    let placedCount = 0;

    function flushCurrentPage() {
      if (currentBlocks.length <= leadBlocks.length) return;
      _log('flushPage pageIndex=' + pages.length,
        'usedHeight=' + bodyEl.scrollHeight,
        'remaining=' + Math.max(0, pageBodyHeight - bodyEl.scrollHeight),
        'blocksOnPage=' + (currentBlocks.length - leadBlocks.length));
      pages.push(createPage({
        id: section.id,
        className: section.pageClassName,
        bodyClassName: section.bodyClassName,
        blocks: currentBlocks.slice(),
        footer: section.footer,
      }));
      currentBlocks = leadBlocks.slice();
      placedCount = 0;
    }

    // Row-level pagination for quote-group-rowset blocks.
    // Linearly scans rows, finds how many fit on the current page, flushes
    // mid-group when a page is full, and adds continuation headers automatically.
    function handleRowset(rowsetBlock) {
      var remainingRows = rowsetBlock.rowsHtml.slice();
      var isFirst = true;

      // Empty group: still render the header + "no items" row.
      if (remainingRows.length === 0) {
        var emptySegHtml = rowsetBlock.renderSegment([], true, true);
        currentBlocks.push({
          html: '<div class="qp-compose-block qp-block-quote-group" data-block-id="' +
                rowsetBlock.id + '">' + emptySegHtml + '</div>',
        });
        placedCount += 1;
        return;
      }

      // Rowset probing uses a slightly stricter tolerance than regular blocks.
      // Effective tolerance = PAGE_TOLERANCE - ROWSET_MARGIN = -12 - 8 = -20px.
      // Reduced from 32 to 8: the previous 32px margin caused premature page flushes
      // that left large whitespace at page bottoms when adjacent small groups could
      // have packed together on the same page.
      var ROWSET_MARGIN = 8;
      function fitsRowset(probeBlocks) {
        setBodyHtml(bodyEl, probeBlocks);
        // Use pageBodyHeight (captured before height:auto) as the reference.
        // bodyEl.scrollHeight now correctly reports actual content height.
        return bodyEl.scrollHeight <= pageBodyHeight + PAGE_TOLERANCE - ROWSET_MARGIN;
      }

      while (remainingRows.length > 0) {
        // Find the maximum number of rows that fit on the current page.
        //
        // RULE 1+2 (no empty group opening): The probe loop starts at ri=1, meaning
        // "title + table header + at least 1 data row" must fit before the group is
        // allowed to open on this page. fittingCount=0 after the loop means not even
        // 1 row fits — the group must not open here (would leave title+header only).
        //
        // Starting at ri=1 (rather than using a separate min-block pre-check) ensures
        // a single DOM measurement is used to answer both "can we open?" and "how many
        // rows fit?" — eliminating any inconsistency between two separate checks of
        // identical HTML that could cause the group to open but then have its rows
        // skipped on the subsequent flush.
        var fittingCount = 0;
        for (var ri = 1; ri <= remainingRows.length; ri += 1) {
          var rowsSlice = remainingRows.slice(0, ri);
          var probeIsLast = ri === remainingRows.length;
          var probeHtml = rowsetBlock.renderSegment(rowsSlice, isFirst, probeIsLast);
          var probeBlock = {
            html: '<div class="qp-compose-block qp-block-quote-group" data-block-id="' +
                  rowsetBlock.id + '">' + probeHtml + '</div>',
          };
          var _fits = fitsRowset(currentBlocks.concat(probeBlock));
          if (_fits) {
            fittingCount = ri;
          } else {
            break; // monotonic: more rows only increases height
          }
        }

        // fittingCount === 0: not even 1 row fits on the current page.
        // The group must NOT open here — doing so would leave title+header with
        // zero data rows at the page bottom (Rule 2: no empty tail).
        // rowIndex is NOT advanced and isFirst is NOT changed (Rule 3).
        if (fittingCount === 0) {
          if (placedCount > 0) {
            _log('rowset=' + rowsetBlock.id, 'fittingCount=0 → flush+retry',
              'placedCount=' + placedCount, 'remainingRows=' + remainingRows.length);
            flushCurrentPage();
            continue;
          }
          _log('rowset=' + rowsetBlock.id, 'fittingCount=0 on fresh page → force fittingCount=1');
          fittingCount = 1;
        }

        var rowsToPlace = remainingRows.slice(0, fittingCount);
        remainingRows = remainingRows.slice(fittingCount);
        var isLastSegment = remainingRows.length === 0;
        _log('rowset=' + rowsetBlock.id, 'placing fittingCount=' + fittingCount,
          'isFirst=' + isFirst, 'isLastSegment=' + isLastSegment,
          'remainingRows=' + remainingRows.length);

        // Rule 4: subtotal (isLastSegment=true) only on the final segment of this group.
        var segHtml = rowsetBlock.renderSegment(rowsToPlace, isFirst, isLastSegment);
        var segBlock = {
          html: '<div class="qp-compose-block qp-block-quote-group" data-block-id="' +
                rowsetBlock.id + '">' + segHtml + '</div>',
        };
        currentBlocks.push(segBlock);
        placedCount += 1;

        if (!isLastSegment) {
          // Page full — flush and continue placing remaining rows on the next page.
          // Rule 3: the next iteration will use isFirst=false, rendering a continuation
          // header (with the （続）badge) at the top of the new segment.
          flushCurrentPage();
        }
        // Rule 3: mark group as started ONLY after at least one row was placed.
        // This ensures that if we flushed without placing (fittingCount=0 path above),
        // isFirst remains true so the next page gets the full title, not （续）.
        isFirst = false;
      }
    }

    for (let index = 0; index < sourceBlocks.length; index += 1) {
      const block = sourceBlocks[index];

      // Delegate rowset blocks to the row-level paginator.
      if (block.type === 'quote-group-rowset') {
        handleRowset(block);
        continue;
      }

      if (block.keepWithNext && sourceBlocks[index + 1] && placedCount > 0) {
        const pair = currentBlocks.concat(block, sourceBlocks[index + 1]);
        if (!fitsBlocks(bodyEl, pair, pageBodyHeight)) {
          flushCurrentPage();
        }
      }

      const next = currentBlocks.concat(block);
      if (fitsBlocks(bodyEl, next, pageBodyHeight)) {
        currentBlocks.push(block);
        placedCount += 1;
        continue;
      }

      if (placedCount > 0) {
        flushCurrentPage();
        index -= 1;
        continue;
      }

      currentBlocks.push(block);
      placedCount += 1;
      flushCurrentPage();
    }

    flushCurrentPage();
    return pages;
  }

  function finalizePages(pages) {
    const totalPages = pages.length;
    return pages.map((page, index) => createPage({
      id: page.id || `page-${index + 1}`,
      pageNo: index + 1,
      totalPages,
      className: page.className,
      bodyClassName: page.bodyClassName,
      blocks: page.blocks,
      footer: {
        left: page.footer && page.footer.left ? page.footer.left : '',
        right: page.footer && page.footer.right ? page.footer.right : `${String(index + 1).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`,
      },
    }));
  }

  // Debug logging: enabled by ?debugPagination=1 in the URL.
  // All messages are prefixed [PQ-PAGINATION] for easy console filtering.
  const _debugPagination = (typeof location !== 'undefined') &&
    new URLSearchParams(location.search).get('debugPagination') === '1';
  function _log() {
    if (_debugPagination) console.log('[PQ-PAGINATION]', ...arguments);
  }

  function compose(documentPlan, options) {
    void options;
    const pages = [];

    (documentPlan.sections || []).forEach((section) => {
      if (!section || !Array.isArray(section.blocks) || section.blocks.length === 0) return;
      if (section.mode === 'fixed') {
        pages.push(...composeFixedPage(section));
      } else {
        pages.push(...composeFlowPages(section));
      }
    });

    const finalized = finalizePages(pages);
    return {
      pages: finalized,
      totalPages: finalized.length,
      stable: finalized.length > 0,
      diagnostics: [],
    };
  }

  function composePreviewPages(documentPlan, options) {
    return compose(documentPlan, options);
  }

  function composeExportPages(documentPlan, options) {
    return compose(documentPlan, options);
  }

  function renderPages(result) {
    const pages = result && Array.isArray(result.pages) ? result.pages : [];
    return {
      html: pages.map((page) => `
        <section class="qp-page ${page.className || ''}" data-page-no="${page.pageNo}" data-page-total="${page.totalPages}">
          <div class="qp-page-inner">
            <div class="qp-page-body ${page.bodyClassName || ''}">
              ${page.blocks.map((block) => block.html).join('')}
            </div>
            <div class="qp-page-footer">
              <span>${page.footer.left || ''}</span>
              <span>${page.footer.right || ''}</span>
            </div>
          </div>
        </section>
      `).join(''),
      totalPages: Number(result && result.totalPages ? result.totalPages : 0),
      pages,
    };
  }

  window.ProjectQuotationComposer = {
    createPage,
    createComposeState,
    compose,
    composePreviewPages,
    composeExportPages,
    renderPages,
  };
})();
