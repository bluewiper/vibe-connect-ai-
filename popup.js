/**
 * VibeConnect 팝업 - OpenAI API Key 설정 및 저장
 * API Key는 chrome.storage.local에만 저장되며, 우리 서버를 거치지 않습니다.
 * Vibe AI 사용 시 브라우저에서 직접 api.openai.com으로만 전송됩니다.
 */

(function () {
  'use strict';

  const input = document.getElementById('api-key');
  const saveBtn = document.getElementById('save-key');
  const testBtn = document.getElementById('test-key');
  const statusEl = document.getElementById('status');

  function showStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#c00' : '#057642';
  }

  function loadStoredKey() {
    chrome.storage.local.get(['openaiApiKey'], function (data) {
      if (data.openaiApiKey) {
        input.value = data.openaiApiKey;
      }
    });
  }

  saveBtn.addEventListener('click', function () {
    const key = (input.value || '').trim();
    if (!key) {
      showStatus('API 키를 입력해 주세요.', true);
      return;
    }
    if (!key.startsWith('sk-')) {
      showStatus('API 키는 sk-로 시작하는 값이에요. 다시 확인해 주세요.', true);
      return;
    }

    chrome.storage.local.set({ openaiApiKey: key }, function () {
      showStatus('저장했어요.');
    });
  });

  testBtn.addEventListener('click', function () {
    var key = (input.value || '').trim();
    if (!key) {
      chrome.storage.local.get(['openaiApiKey'], function (data) {
        key = (data.openaiApiKey || '').trim();
        if (!key) {
          showStatus('API 키를 입력하고 저장한 뒤, 또는 이미 저장된 키가 있으면 입력란에 넣고 테스트해 주세요.', true);
          return;
        }
        runTest(key);
      });
      return;
    }
    runTest(key);
  });

  function runTest(key) {
    if (!key || !key.startsWith('sk-')) {
      showStatus('사용할 API 키가 없어요.', true);
      return;
    }
    testBtn.disabled = true;
    showStatus('연결 확인 중…', false);

    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say exactly: OK' }],
        max_tokens: 10
      })
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (err) {
            throw new Error(err.error && err.error.message ? err.error.message : 'API 오류: ' + res.status);
          }, function () {
            throw new Error('API 오류: ' + res.status);
          });
        }
        return res.json();
      })
      .then(function () {
        showStatus('연결됐어요. 링크드인에서 Vibe AI 쓰시면 돼요.');
      })
      .catch(function (err) {
        var msg = err.message || '';
        if (/quota|exceeded|billing|plan/i.test(msg)) {
          showStatus('연결은 됐는데, OpenAI 사용 한도를 다 썼어요. platform.openai.com에서 결제·플랜 확인해 주세요.', true);
        } else {
          showStatus(msg || '연결이 안 돼요. 키랑 인터넷 연결 확인해 주세요.', true);
        }
      })
      .then(function () {
        testBtn.disabled = false;
      });
  }

  loadStoredKey();
})();
