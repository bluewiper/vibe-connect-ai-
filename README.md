# VibeConnect

링크드인 댓글 작성을 돕는 Chrome 확장 프로그램. 게시물을 읽고 어울리는 댓글 3개를 추천해 줍니다.

- **Manifest V3** 기반
- OpenAI **GPT-4o-mini** 사용 (본인 API 키 필요)
- API 키는 브라우저 로컬에만 저장되며, Vibe AI 사용 시에만 OpenAI로 전송됩니다.

## 설치 방법

1. 이 저장소를 클론하거나 ZIP으로 다운로드합니다.
2. Chrome에서 `chrome://extensions` 접속 → **개발자 모드** 켜기.
3. **압축 해제된 확장 프로그램을 로드합니다** → 프로젝트 폴더 선택.

## 사용 방법

1. 확장 프로그램 아이콘 클릭 → **OpenAI API 키** 입력 후 **저장** → **연결 테스트**로 확인.
2. [LinkedIn](https://www.linkedin.com) 피드에서 댓글을 달 게시물의 **댓글**을 연 뒤, 댓글 입력창 **바로 위**에 있는 **Vibe AI** 버튼 클릭.
3. 추천 댓글 3개 중 마음에 드는 것을 선택하면 댓글창에 자동으로 입력됩니다.

## 프로젝트 구조

```
vibe-connect-ai/
├── manifest.json   # 확장 프로그램 설정 (Manifest V3)
├── content.js      # 링크드인 페이지에 버튼 삽입 및 AI 댓글 요청
├── popup.html      # 설정 팝업 UI
├── popup.js        # API 키 저장/연결 테스트
├── styles.css      # 버튼·선택 패널 스타일
└── README.md
```

## 요구 사항

- Chrome (또는 Chromium 기반 브라우저)
- [OpenAI API 키](https://platform.openai.com/api-keys) (결제 설정된 계정 권장)

## 라이선스

MIT
