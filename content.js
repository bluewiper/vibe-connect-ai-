/**
 * VibeConnect - 링크드인 댓글창(div.ql-editor) 바로 위에 'Vibe AI' 버튼 삽입
 * MutationObserver로 스크롤 시 새로 로드되는 게시물의 댓글창에도 자동 추가
 */

(function () {
  'use strict';

  const VIBE_BUTTON_ID_PREFIX = 'vibe-connect-ai-btn-';
  const WRAPPER_CLASS = 'vibe-connect-wrapper';

  /**
   * 현재 댓글창이 속한 피드 게시물 영역에서 텍스트 추출
   */
  function getNearbyPostText(anchorElement) {
    const feedItem = anchorElement.closest('.feed-shared-update-v2, [data-urn*="urn:li:activity"], .scaffold-feed__main');
    if (!feedItem) return '';

    const selectors = [
      '.feed-shared-update-v2__description',
      '.feed-shared-inline-show-more-text',
      '[data-control-name="update_content"]',
      '.update-components-text',
      '.break-words'
    ];

    for (const sel of selectors) {
      const el = feedItem.querySelector(sel);
      if (el) {
        const text = (el.textContent || '').trim();
        if (text.length > 0) return text.slice(0, 3000);
      }
    }

    const firstBlock = feedItem.querySelector('.feed-shared-update-v2__description, .break-words');
    return (firstBlock && firstBlock.textContent || '').trim().slice(0, 3000) || '';
  }

  /**
   * 댓글 입력창 요소 바로 위에 Vibe AI 버튼 삽입
   * @param {Element} editorEl - 댓글 입력 요소 (div.ql-editor 또는 contenteditable 등)
   */
  function injectVibeButtonAboveEditor(editorEl) {
    if (!editorEl || !editorEl.parentNode) return;
    if (editorEl.previousElementSibling && editorEl.previousElementSibling.classList.contains(WRAPPER_CLASS)) return;

    const wrapper = document.createElement('div');
    wrapper.className = WRAPPER_CLASS;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = VIBE_BUTTON_ID_PREFIX + Math.random().toString(36).slice(2, 10);
    btn.className = 'vibe-connect-ai-button';
    btn.textContent = 'Vibe AI';
    btn.title = '게시물 보고 어울리는 댓글 초안 추천해줄게요';

    btn.addEventListener('click', async function () {
      const postText = getNearbyPostText(editorEl);
      const apiKey = await getStoredApiKey();
      if (!apiKey) {
        alert('먼저 확장 프로그램 아이콘에서 API 키를 저장해 주세요.');
        return;
      }
      onVibeAiClick(btn, editorEl, postText, apiKey);
    });

    wrapper.appendChild(btn);
    editorEl.parentNode.insertBefore(wrapper, editorEl);
  }

  /**
   * API Key는 chrome.storage.local에만 저장되며, Vibe AI 클릭 시 OpenAI API(api.openai.com) 요청에만 사용됩니다.
   * 다른 서버로 전송되지 않습니다.
   */
  function getStoredApiKey() {
    return new Promise(function (resolve) {
      chrome.storage.local.get(['openaiApiKey'], function (data) {
        resolve(data.openaiApiKey || '');
      });
    });
  }

  /**
   * Vibe AI 클릭: 게시물 본문 추출 → API Key(local) → GPT-4o-mini로 서비스 지향 댓글 3개 요청 → 선택 UI 표시
   */
  async function onVibeAiClick(buttonEl, qlEditor, postText, apiKey) {
    const originalLabel = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = '생성 중…';

    try {
      const comments = await fetchThreeCommentSuggestions(apiKey, postText);
      if (!comments || comments.length === 0) {
        alert('추천 댓글을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
        return;
      }
      showCommentChoiceUI(qlEditor, comments, buttonEl);
    } catch (err) {
      console.error('VibeConnect:', err);
      alert('댓글을 불러오지 못했어요. API 키와 인터넷 연결을 확인해 주세요.');
    } finally {
      buttonEl.textContent = originalLabel;
      buttonEl.disabled = false;
    }
  }

  /**
   * OpenAI GPT-4o-mini: '이 게시물에 달 서비스 지향적인 댓글 3개를 추천해줘' 요청 후 3개 문자열 배열 반환
   */
  function fetchThreeCommentSuggestions(apiKey, postText) {
    const userPrompt = postText
      ? `이 게시물에 달기 좋은 댓글 3개만 추천해줘. 자연스럽게.\n\n[게시물]\n${postText}`
      : '이 게시물에 달기 좋은 댓글 3개만 추천해줘. 자연스럽게.';

    const systemPrompt = '링크드인에 실제로 달 것 같은 댓글을 써줘. 말투는 친근하고 자연스럽게, 과하지 않게. 한 댓글당 한두 문장 정도로 짧게. 정확히 3개만, 1. 2. 3. 번호로 구분해서 한 줄에 하나씩만 출력해. 해시태그나 격한 칭찬은 빼고, 진심이 느껴지게 써줘.';

    /* API Key는 이 요청에서만 사용되며, OpenAI 외 다른 서버로 전송되지 않음 */
    return fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('API error: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        return parseThreeComments((content || '').trim());
      });
  }

  /**
   * 응답 텍스트에서 댓글 3개 추출 (1. ... 2. ... 3. ... 또는 줄 단위)
   */
  function parseThreeComments(text) {
    if (!text) return [];
    const lines = text.split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    const result = [];
    for (var i = 0; i < lines.length && result.length < 3; i++) {
      var line = lines[i];
      line = line.replace(/^\d+[.)]\s*/, '').replace(/^[-*]\s*/, '').trim();
      if (line.length > 0) result.push(line);
    }
    return result.slice(0, 3);
  }

  /**
   * 댓글 3개 선택 UI 표시 → 선택 시 해당 텍스트를 댓글 입력창에 넣고 UI 제거
   */
  function showCommentChoiceUI(qlEditor, comments, buttonEl) {
    var panel = document.getElementById('vibe-connect-choice-panel');
    if (panel) panel.remove();

    panel = document.createElement('div');
    panel.id = 'vibe-connect-choice-panel';
    panel.className = 'vibe-connect-choice-panel';

    var title = document.createElement('div');
    title.className = 'vibe-connect-choice-title';
    title.textContent = '마음에 드는 댓글 골라 보세요';
    panel.appendChild(title);

    comments.forEach(function (text, index) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'vibe-connect-choice-item';
      item.textContent = text;
      item.title = text;
      item.addEventListener('click', function () {
        insertSuggestionIntoCommentBox(qlEditor, text);
        panel.remove();
      });
      panel.appendChild(item);
    });

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'vibe-connect-choice-close';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', function () { panel.remove(); });
    panel.appendChild(closeBtn);

    document.body.appendChild(panel);
    var rect = buttonEl.getBoundingClientRect();
    var panelHeight = panel.getBoundingClientRect().height;
    var panelWidth = panel.getBoundingClientRect().width;
    var left = rect.left;
    if (left + panelWidth > document.documentElement.clientWidth - 8) left = document.documentElement.clientWidth - panelWidth - 8;
    if (left < 8) left = 8;
    panel.style.top = Math.max(8, rect.top - panelHeight - 8) + 'px';
    panel.style.left = left + 'px';
  }

  /**
   * 제안 텍스트를 댓글 입력창(div.ql-editor 또는 contenteditable)에 넣기
   */
  function insertSuggestionIntoCommentBox(editorEl, text) {
    if (!text || !editorEl) return;

    if (editorEl.classList.contains('ql-editor') || editorEl.getAttribute('contenteditable') === 'true') {
      editorEl.focus();
      const range = document.createRange();
      range.selectNodeContents(editorEl);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, text);
      return;
    }

    const editable = editorEl.querySelector('[contenteditable="true"], [role="textbox"]');
    if (editable) {
      editable.focus();
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, text);
      return;
    }

    const input = editorEl.querySelector('textarea, input[type="text"]');
    if (input) {
      input.focus();
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * 링크드인 댓글 입력 영역 후보 수집 (DOM 구조 변경에 대응해 여러 선택자 사용)
   */
  function getCommentEditorCandidates() {
    var seen = new Set();
    var list = [];

    function add(el) {
      if (el && !seen.has(el)) {
        seen.add(el);
        list.push(el);
      }
    }

    // 1) 댓글 박스 내부의 Quill 에디터
    document.querySelectorAll('.comments-comment-box div.ql-editor').forEach(add);
    // 2) 댓글 폼 컨테이너 내부 에디터
    document.querySelectorAll('.comments-comment-box__form-container div.ql-editor').forEach(add);
    document.querySelectorAll('.comments-comment-box__form-container [contenteditable="true"]').forEach(add);
    // 3) 피드 게시물 내 댓글용 ql-editor (상단 공유박스 제외: 댓글 섹션만)
    document.querySelectorAll('.comments-comment-box .ql-editor, .comments-comment-box [contenteditable="true"]').forEach(add);
    document.querySelectorAll('.feed-shared-update-v2 .comments-comment-box div.ql-editor').forEach(add);
    document.querySelectorAll('.feed-shared-update-v2 .comments-comment-box [contenteditable="true"]').forEach(add);
    // 4) 일반 ql-editor (피드/활동 영역 내부만, 상단 작성창 제외)
    document.querySelectorAll('.feed-shared-update-v2 div.ql-editor, [data-urn*="urn:li:activity"] .comments-comment-box div.ql-editor').forEach(add);
    // 5) 댓글 플레이스홀더가 있는 영역 근처 contenteditable
    document.querySelectorAll('div.ql-editor').forEach(function (el) {
      var inComment = el.closest('.comments-comment-box') || el.closest('[data-control-name*="comment"]') || el.closest('.comment-composer');
      if (inComment) add(el);
    });
    // 6) placeholder/aria로 댓글 입력창 추정
    document.querySelectorAll('[contenteditable="true"][data-placeholder*="댓글"], [contenteditable="true"][data-placeholder*="comment" i], [contenteditable="true"][aria-label*="댓글"], [contenteditable="true"][aria-label*="comment" i]').forEach(add);
    // 7) 피드 게시물 내의 마지막 contenteditable (댓글 입력으로 쓰이는 경우)
    document.querySelectorAll('.feed-shared-update-v2 [contenteditable="true"]').forEach(function (el) {
      if (el.closest('.comments-comment-box') || el.closest('.comment-composer') || el.getAttribute('data-placeholder')) add(el);
    });

    return list;
  }

  /**
   * 수집한 댓글 입력창 각각 바로 위에 버튼 삽입
   */
  function scanAndInject() {
    getCommentEditorCandidates().forEach(function (editorEl) {
      injectVibeButtonAboveEditor(editorEl);
    });
  }

  let scanScheduled = null;
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = requestAnimationFrame(function () {
      scanScheduled = null;
      scanAndInject();
    });
  }

  const observer = new MutationObserver(function (mutations) {
    const hasNewNodes = mutations.some(function (m) { return m.addedNodes.length > 0; });
    if (hasNewNodes) scheduleScan();
  });

  function startObserving() {
    if (!document.body) return;
    observer.observe(document.body, { childList: true, subtree: true });
    scanAndInject();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserving);
  } else {
    startObserving();
  }
})();
