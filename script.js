// 전역 변수 선언
let allQuizData = []; // 모든 퀴즈 데이터를 저장할 배열
let filteredQuizData = []; // 선택된 회차 및 과목에 따라 필터링된 퀴즈 데이터
let rounds = []; // 사용 가능한 모든 회차 (연월일)
let availableSubjects = []; // 사용 가능한 모든 과목
let currentQuestionIndex = 0; // 현재 풀고 있는 문제의 인덱스
let score = 0; // 점수
let selectedOption = null; // 사용자가 선택한 옵션을 저장할 변수
let incorrectQuestions = []; // 틀린 문제들을 저장할 배열 (현재 세션 내에서만 유효)
let isReviewMode = false; // 틀린 문제 풀이 모드인지 여부
let isCheckedQuestionsMode = false; // 체크 문제 풀이 모드인지 여부
let selectedSubjectsForCheckedQuiz = []; // 체크 문제 풀이 시 선택된 과목들

// 로컬 스토리지 키
const CHECKED_QUESTIONS_KEY = 'checkedQuestions'; // { 'YYYYMMDD-문제번호': true } 형태
const LAST_QUIZ_STATE_KEY = 'lastQuizState'; // 마지막 푼 문제 정보 저장용
const TEMPORARY_EXPLANATIONS_KEY = 'temporaryExplanations'; // 임시 저장 해설 저장용

// 페이지 로드 시 초기화 함수 호출
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadQuizData(); // 퀴즈 데이터 로드
    setupEventListeners(); // 이벤트 리스너 설정
    showPage('main-page'); // 메인 페이지 표시
    updateContinueLastQuizButton(); // 마지막 푼 문제 버튼 상태 업데이트
}

async function loadQuizData() {
    try {
        const response = await fetch('quiz_data.json');

        if (!response.ok) {
            throw new Error(`HTTP 오류! 상태: ${response.status} ${response.statusText}`);
        }

        allQuizData = await response.json();

        // '연월일' 필드를 기준으로 오름차순 정렬된 유니크한 회차 목록 생성
        rounds = [...new Set(allQuizData.map(q => q['연월일']))].sort();
        availableSubjects = [...new Set(allQuizData.map(q => q['과목']))].sort();

        populateMainPage();
        populateCheckedQuizSubjectSelection(); // 체크 문제 풀이용 과목 선택 UI도 미리 채워둡니다.
    } catch (error) {
        console.error('퀴즈 데이터를 로드하는 중 오류 발생:', error);

        let errorMessage = '퀴즈 데이터를 불러오는 데 실패했습니다.';

        if (error instanceof TypeError) {
            errorMessage += '\n네트워크 연결을 확인하거나 파일 경로를 다시 확인해주세요.';
            errorMessage += '\n("quiz_data.json" 파일을 찾을 수 없습니다.)';
        } else if (error.message.includes('HTTP 오류')) {
            errorMessage += `\n서버 응답 오류: ${error.message}`;
            errorMessage += '\n("quiz_data.json" 파일이 올바른 위치에 있는지 확인해주세요.)';
        } else if (error instanceof SyntaxError) {
            errorMessage += '\n"quiz_data.json" 파일의 내용이 유효한 JSON 형식이 아닙니다.';
            errorMessage += '\n파일 내용을 텍스트 편집기로 열어 JSON 문법 오류를 확인해주세요.';
        } else {
            errorMessage += `\n자세한 오류: ${error.message}`;
        }

        alert(errorMessage);
    }
}

function populateMainPage() {
    const roundSelect = document.getElementById('round-select');
    const subjectCheckboxesContainer = document.getElementById('subject-checkboxes-container');
    const toggleAllSubjectsButton = document.getElementById('toggle-all-subjects-button');

    roundSelect.innerHTML = '<option value="">회차 선택</option>';
    rounds.forEach(round => {
        const option = document.createElement('option');
        option.value = round;
        option.textContent = round;
        roundSelect.appendChild(option);
    });

    subjectCheckboxesContainer.innerHTML = '';
    availableSubjects.forEach(subject => {
        const label = document.createElement('label');
        // 과목 선택 체크박스는 기본적으로 해제된 상태로 표시
        label.innerHTML = `
            <input type="checkbox" name="subject" value="${subject}"> ${subject}
        `;
        subjectCheckboxesContainer.appendChild(label);
    });

    // 메인 페이지 로드 시 '전체 선택' 버튼 텍스트 초기화
    if (toggleAllSubjectsButton) {
        toggleAllSubjectsButton.textContent = '전체 선택';
    }
}

// ⭐ 수정: 체크 문제 풀이용 과목 선택 UI 채우기 (모달 내부 컨테이너 사용)
function populateCheckedQuizSubjectSelection() {
    const checkedQuizSubjectCheckboxesContainer = document.getElementById('checked-subject-checkboxes-container');
    if (!checkedQuizSubjectCheckboxesContainer) {
        console.warn("#checked-subject-checkboxes-container 요소를 찾을 수 없습니다. 체크 문제 풀이 과목 선택 UI를 초기화할 수 없습니다.");
        return; // 요소가 없으면 함수 종료
    }

    // 기존 내용 중 '전체 선택' 버튼과 체크박스 래퍼는 삭제하고 다시 생성
    checkedQuizSubjectCheckboxesContainer.innerHTML = '';

    // '전체 선택' 버튼을 먼저 생성
    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggle-all-checked-subjects-button';
    toggleButton.textContent = '전체 선택';
    toggleButton.addEventListener('click', toggleAllCheckedSubjects);
    checkedQuizSubjectCheckboxesContainer.appendChild(toggleButton); // 버튼 추가

    // 과목 체크박스를 감싸는 div 추가 (CSS를 위해)
    const checkboxesWrapper = document.createElement('div');
    checkboxesWrapper.classList.add('subject-checkboxes-wrapper'); // 새 클래스 추가 (CSS에서 사용)
    checkedQuizSubjectCheckboxesContainer.appendChild(checkboxesWrapper);


    availableSubjects.forEach(subject => {
        const label = document.createElement('label');
        label.innerHTML = `
            <input type="checkbox" name="checkedSubject" value="${subject}"> ${subject}
        `;
        checkboxesWrapper.appendChild(label); // 래퍼 안에 체크박스 추가
    });
}


function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    document.getElementById(pageId).style.display = 'block';

    // 메인 페이지로 전환 시, 체크 문제 선택 모달 숨기기
    const checkedQuizModal = document.getElementById('checked-quiz-modal');
    if (pageId === 'main-page' && checkedQuizModal) {
        checkedQuizModal.style.display = 'none';
    }
}

// '전체 선택/해제' 버튼 토글 로직 (일반 퀴즈용)
function toggleAllSubjects() {
    const subjectCheckboxes = document.querySelectorAll('#subject-checkboxes-container input[type="checkbox"]');
    const toggleButton = document.getElementById('toggle-all-subjects-button');

    const allCurrentlyChecked = Array.from(subjectCheckboxes).every(cb => cb.checked);

    subjectCheckboxes.forEach(checkbox => {
        checkbox.checked = !allCurrentlyChecked;
    });

    toggleButton.textContent = allCurrentlyChecked ? '전체 선택' : '전체 해제';
}

// '전체 선택/해제' 버튼 토글 로직 (체크 문제 모달용)
function toggleAllCheckedSubjects() {
    // #checked-subject-checkboxes-container 바로 아래에 있는 체크박스가 아니라,
    // populateCheckedQuizSubjectSelection에서 추가한 .subject-checkboxes-wrapper 내부의 체크박스를 선택
    const subjectCheckboxes = document.querySelectorAll('#checked-subject-checkboxes-container .subject-checkboxes-wrapper input[name="checkedSubject"]');
    const toggleButton = document.getElementById('toggle-all-checked-subjects-button'); // 모달 내부의 버튼

    const allCurrentlyChecked = Array.from(subjectCheckboxes).every(cb => cb.checked);

    subjectCheckboxes.forEach(checkbox => {
        checkbox.checked = !allCurrentlyChecked;
    });

    toggleButton.textContent = allCurrentlyChecked ? '전체 선택' : '전체 해제';
}

// --- 로컬 스토리지 관련 함수 (체크된 문제) ---
function getCheckedQuestions() {
    const data = localStorage.getItem(CHECKED_QUESTIONS_KEY);
    try {
        const parsed = data ? JSON.parse(data) : {};
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed;
        } else {
            console.warn("경고: 'checkedQuestions' localStorage 데이터가 유효한 객체 형식이 아닙니다. 데이터를 초기화합니다.");
            return {};
        }
    } catch (e) {
        console.error("오류: 'checkedQuestions' localStorage 데이터를 파싱하는 중 오류 발생. 데이터를 초기화합니다.", e);
        return {};
    }
}

function saveCheckedQuestion(round, questionNumber) {
    const checkedQuestions = getCheckedQuestions();
    const key = `${round}-${questionNumber}`;
    checkedQuestions[key] = true;
    localStorage.setItem(CHECKED_QUESTIONS_KEY, JSON.stringify(checkedQuestions));
}

function removeCheckedQuestion(round, questionNumber) {
    const checkedQuestions = getCheckedQuestions();
    const key = `${round}-${questionNumber}`;
    delete checkedQuestions[key];
    localStorage.setItem(CHECKED_QUESTIONS_KEY, JSON.stringify(checkedQuestions));
}

function isQuestionChecked(round, questionNumber) {
    const checkedQuestions = getCheckedQuestions();
    const key = `${round}-${questionNumber}`;
    return !!checkedQuestions[key]; // boolean으로 반환
}
// --- 로컬 스토리지 관련 함수 (체크된 문제) 끝 ---

// --- 로컬 스토리지 관련 함수 (마지막 푼 문제) ---
function getLastQuizState() {
    const data = localStorage.getItem(LAST_QUIZ_STATE_KEY);
    return data ? JSON.parse(data) : null;
}

function saveLastQuizState(round, subjects, questionIndex) {
    const state = { round, subjects, questionIndex };
    localStorage.setItem(LAST_QUIZ_STATE_KEY, JSON.stringify(state));
    updateContinueLastQuizButton(); // 저장 후 버튼 상태 업데이트
}

function clearLastQuizState() {
    localStorage.removeItem(LAST_QUIZ_STATE_KEY);
    updateContinueLastQuizButton(); // 삭제 후 버튼 상태 업데이트
}

function updateContinueLastQuizButton() {
    const continueButton = document.getElementById('continue-last-quiz-button');
    const lastState = getLastQuizState();
    if (lastState) {
        continueButton.style.display = 'inline-block';
        continueButton.textContent = `마지막 푼 문제부터 (${lastState.round} ${lastState.subjects.join(', ')} - ${lastState.questionIndex + 1}번)`;
    } else {
        continueButton.style.display = 'none';
    }
}
// --- 로컬 스토리지 관련 함수 (마지막 푼 문제) 끝 ---

// --- 로컬 스토리지 관련 함수 (임시 저장 해설) ---
function getTemporaryExplanations() {
    const data = localStorage.getItem(TEMPORARY_EXPLANATIONS_KEY);
    try {
        const parsed = data ? JSON.parse(data) : {};
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed;
        } else {
            console.warn("경고: 'temporaryExplanations' localStorage 데이터가 유효한 객체 형식이 아닙니다. 데이터를 초기화합니다.");
            return {};
        }
    } catch (e) {
        console.error("오류: 'temporaryExplanations' localStorage 데이터를 파싱하는 중 오류 발생. 데이터를 초기화합니다.", e);
        return {};
    }
}

function saveTemporaryExplanation() {
    const currentQuestion = filteredQuizData[currentQuestionIndex];
    if (!currentQuestion) {
        alert('현재 문제 정보가 없습니다.');
        return;
    }

    const explanationInput = document.getElementById('new-explanation-input');
    let explanationText = explanationInput.value.trim();

    // 해설 내용의 콤마를 언더바로 변환하여 저장
    const explanationToSave = explanationText.replace(/,/g, '_');

    const tempExplanations = getTemporaryExplanations();
    const key = `${currentQuestion['연월일']}-${currentQuestion['문제번호']}`;

    // 내용이 비어있으면 삭제, 아니면 저장
    if (explanationToSave === '') {
        delete tempExplanations[key];
        alert('해설이 삭제되었습니다.');
    } else {
        tempExplanations[key] = explanationToSave;
        alert('해설이 임시 저장되었습니다.');
    }

    localStorage.setItem(TEMPORARY_EXPLANATIONS_KEY, JSON.stringify(tempExplanations));
}

function exportTemporaryExplanations() {
    const tempExplanations = getTemporaryExplanations();
    const exportData = [];

    // 문제 번호와 연월일 순으로 정렬하기 위해, 원래 문제 데이터와 매칭
    const sortedKeys = Object.keys(tempExplanations).sort((a, b) => {
        const [roundA, qNumA] = a.split('-');
        const [roundB, qNumB] = b.split('-');
        if (roundA === roundB) {
            return parseInt(qNumA) - parseInt(qNumB);
        }
        return roundA.localeCompare(roundB);
    });

    sortedKeys.forEach(key => {
        const [round, questionNumber] = key.split('-');
        const explanation = tempExplanations[key];
        // 저장된 _를 다시 ,로 변환하여 내보내기
        // exportData.push(`회차: ${round}, 문제번호: ${questionNumber}, 해설: ${explanation.replace(/_/g, ',')}`);
		exportData.push(`회차: ${round}, 문제번호: ${questionNumber}, 해설: ${explanation}`);
    });

    if (exportData.length === 0) {
        alert('임시 저장된 해설이 없습니다.');
        return;
    }

    const contentToCopy = exportData.join('\n\n');

    navigator.clipboard.writeText(contentToCopy)
        .then(() => {
            alert('임시 저장된 해설이 클립보드에 복사되었습니다.');
        })
        .catch(err => {
            console.error('클립보드 복사 실패:', err);
            alert('클립보드 복사에 실패했습니다. 브라우저 설정을 확인해주세요.');
        });
}

function clearTemporaryExplanations() {
    if (confirm('모든 임시 저장된 해설을 삭제하시겠습니까?')) {
        localStorage.removeItem(TEMPORARY_EXPLANATIONS_KEY);
        alert('임시 저장된 해설이 모두 삭제되었습니다.');
        // 현재 퀴즈 페이지에 있다면 해설 입력 필드도 초기화
        const explanationInput = document.getElementById('new-explanation-input');
        if (explanationInput) {
            explanationInput.value = '';
        }
    }
}
// --- 로컬 스토리지 관련 함수 (임시 저장 해설) 끝 ---

// 정답 문자열을 숫자(1, 2, 3, 4)로 파싱하는 헬퍼 함수
function parseCorrectAnswer(answerString) {
    if (typeof answerString !== 'string') {
        console.warn(`경고: 정답 형식이 문자열이 아닙니다 - '${answerString}'.`);
        return null;
    }

    const unicodeMap = { '①': 1, '②': 2, '③': 3, '④': 4 };

    if (unicodeMap[answerString.trim()]) {
        return unicodeMap[answerString.trim()];
    }

    const parsedNum = parseInt(answerString.trim());
    if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 4) {
        return parsedNum;
    }

    console.warn(`경고: 알 수 없는 정답 형식 - '${answerString}'. 유효하지 않은 정답으로 처리됩니다.`);
    return null;
}

// 퀴즈 시작 함수 (다양한 모드 지원)
function startQuiz(quizQuestions = null, isReview = false, isChecked = false, startFromIndex = 0) {
    let quizToStart = [];
    let selectedRound = '';
    let selectedSubjects = [];

    incorrectQuestions = []; // 새 퀴즈 시작 시 틀린 문제 목록 초기화
    isReviewMode = isReview; // 틀린 문제 풀이 모드 설정
    isCheckedQuestionsMode = isChecked; // 체크 문제 풀이 모드 설정

    if (quizQuestions && Array.isArray(quizQuestions)) { // 틀린/체크/마지막 푼 문제 풀기 모드
        quizToStart = quizQuestions;
        if (quizToStart.length > 0) {
            // 이 모드에서는 selectedRound가 특정 회차일 수도 있고, 여러 회차일 수도 있으므로,
            // 첫 번째 문제의 회차를 대표로 가져오거나, 모든 회차를 포함하도록 처리할 수 있습니다.
            // 여기서는 첫 번째 문제의 회차를 사용합니다.
            selectedRound = quizToStart[0]['연월일'];
            // 이 모드에서는 selectedSubjects는 현재 퀴즈의 과목들을 의미
            selectedSubjects = [...new Set(quizToStart.map(q => q['과목']))];
        }
    } else { // 일반 퀴즈 시작 (메인 페이지에서)
        selectedRound = document.getElementById('round-select').value;
        selectedSubjects = Array.from(document.querySelectorAll('input[name="subject"]:checked'))
            .map(cb => cb.value);

        if (!selectedRound) {
            alert('회차를 선택해주세요.');
            return;
        }
        if (selectedSubjects.length === 0) {
            alert('과목을 하나 이상 선택해주세요.');
            return;
        }

        quizToStart = allQuizData.filter(q =>
            q['연월일'] === selectedRound && selectedSubjects.includes(q['과목'])
        );
    }

    if (quizToStart.length === 0) {
        alert('선택한 조건에 해당하는 문제가 없습니다. 다른 회차나 과목을 선택해주세요.');
        // 모달에서 시작한 경우 모달을 닫고 메인으로 돌아갑니다.
        const checkedQuizModal = document.getElementById('checked-quiz-modal');
        if (checkedQuizModal && checkedQuizModal.style.display === 'block') {
             checkedQuizModal.style.display = 'none';
        }
        showPage('main-page');
        return;
    }

    // 문제 번호 기준으로 정렬
    if (Array.isArray(quizToStart)) {
        quizToStart.sort((a, b) => parseInt(a['문제번호']) - parseInt(b['문제번호']));
    } else {
        console.error("오류: quizToStart가 배열이 아닙니다.", quizToStart);
        alert("퀴즈 문제를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.");
        showPage('main-page');
        return;
    }

    filteredQuizData = quizToStart; // 현재 풀이할 문제 목록 설정
    currentQuestionIndex = startFromIndex; // **수정: 마지막 푼 문제부터 시작 시 인덱스 그대로 사용**
    score = 0; // 점수 초기화
    // 각 문제의 풀이 상태 및 정답 여부 초기화
    filteredQuizData.forEach(q => {
        q.answered = false;
        q.isCorrect = false;
    });

    showPage('quiz-page');
    // 시작 인덱스가 유효한지 확인
    if (currentQuestionIndex < filteredQuizData.length) {
        displayQuestion(filteredQuizData[currentQuestionIndex]);
    } else {
        alert('마지막 푼 회차의 모든 문제를 풀었습니다. 해당 회차의 첫 문제부터 다시 시작합니다.'); // 메시지 변경
        currentQuestionIndex = 0;
        displayQuestion(filteredQuizData[currentQuestionIndex]);
    }

    // 마지막 푼 문제 상태 저장 (일반 퀴즈 시작 시에만)
    if (!isReviewMode && !isCheckedQuestionsMode) {
        saveLastQuizState(selectedRound, selectedSubjects, currentQuestionIndex);
    } else {
        // 리뷰/체크 모드에서는 마지막 푼 문제 상태를 업데이트하지 않음
        // clearLastQuizState(); // 필요하다면 이 모드 종료 시 초기화
    }
}

function displayQuestion(question) {
    const quizQuestionEl = document.getElementById('question-content');
    const quizViewEl = document.getElementById('view-content'); // 보기를 표시할 p 태그
    const quizViewImageEl = document.getElementById('view-image'); // 보기를 표시할 img 태그 (새로 추가)
    const optionsContainer = document.getElementById('options-container');
    const explanationContainer = document.getElementById('explanation-container');
    const newExplanationInput = document.getElementById('new-explanation-input'); // 해설 입력 필드
    const currentQuizInfoEl = document.getElementById('current-quiz-info');
    const nextButton = document.getElementById('next-button');
    const showAnswerButton = document.getElementById('show-answer-button');
    const questionCheckbox = document.getElementById('question-checkbox'); // 체크박스 요소
    const newExplanationSection = document.getElementById('new-explanation-section'); // 해설 입력 섹션
    const prevButton = document.getElementById('prev-button'); // 이전버튼
	
    optionsContainer.innerHTML = '';
    explanationContainer.innerHTML = '';
    explanationContainer.style.display = 'none';
    newExplanationSection.style.display = 'none'; // 다음 문제로 넘어가면 임시 해설 섹션 숨김
    selectedOption = null; // 선택된 옵션 초기화

    currentQuizInfoEl.textContent = `회차: ${question['연월일']} | 과목: ${question['과목']} | 문제번호: ${question['문제번호']}`;
    // _를 ,로 변경하여 표시
    quizQuestionEl.textContent = question['문제내용'].replace(/_/g, ',');

    // --- '보기' 처리 로직 (이미지/텍스트 분리) ---
    quizViewEl.textContent = ''; // 텍스트 보기 내용 초기화
    quizViewEl.style.display = 'none'; // 텍스트 보기 p 태그 초기 숨김

    quizViewImageEl.src = ''; // 이미지 src 초기화
    quizViewImageEl.style.display = 'none'; // 이미지 보기 img 태그 초기 숨김

    if (question['보기'] && question['보기'].trim() !== '') {
        const viewContent = question['보기'].trim();
        // 이미지 파일 경로 형식인지 확인 (예: images/20210515-53.png)
        if (viewContent.startsWith('images/') && /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(viewContent)) {
            quizViewImageEl.src = viewContent;
            quizViewImageEl.style.display = 'block'; // 이미지가 있으면 보이게 함
        } else {
            // 이미지 경로가 아니면 텍스트로 처리
            quizViewEl.textContent = viewContent.replace(/_/g, ',');
            quizViewEl.style.display = 'block'; // 텍스트 보기가 있으면 보이게 함
        }
    }
    // --- '보기' 처리 로직 끝 ---

    // 문제 체크박스 상태 업데이트 및 이벤트 리스너 재설정
    questionCheckbox.checked = isQuestionChecked(question['연월일'], question['문제번호']);
    questionCheckbox.onchange = null;
    questionCheckbox.onchange = (event) => {
        if (event.target.checked) {
            saveCheckedQuestion(question['연월일'], question['문제번호']);
        } else {
            removeCheckedQuestion(question['연월일'], question['문제번호']);
        }
    };

    // --- 선택지 동적 생성 (이미지/텍스트 분리) ---
    for (let i = 1; i <= 4; i++) {
        const optionKey = `선택지${i}`;
        const optionContent = question[optionKey];
        if (optionContent !== null && typeof optionContent !== 'undefined' && optionContent.trim() !== '') {
            const label = document.createElement('label');
            label.classList.remove('option-correct', 'option-wrong');

            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.name = 'option';
            radioInput.value = i;
            label.appendChild(radioInput);

            // 이미지 파일 경로 형식인지 확인 (예: images/20210515-53-1.png)
            if (optionContent.startsWith('images/') && /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(optionContent.trim())) {
                const img = document.createElement('img');
                img.src = optionContent.trim();
                img.alt = `선택지 ${i}`;
                img.classList.add('option-image'); // CSS 스타일링을 위한 클래스 추가

                const optionNumberSpan = document.createElement('span');
                optionNumberSpan.textContent = `${i}. `; // 숫자 (예: 1. )
                label.appendChild(optionNumberSpan);
                label.appendChild(img);
            } else {
                // 텍스트 선택지
                const textNode = document.createTextNode(` ${i}. ${optionContent.replace(/_/g, ',')}`);
                label.appendChild(textNode);
            }

            optionsContainer.appendChild(label);

            radioInput.addEventListener('change', function() {
                selectedOption = parseInt(this.value);
                checkAnswer();
            });
        }
    }
    // --- 선택지 동적 생성 끝 ---

    nextButton.style.display = 'block';
    showAnswerButton.style.display = 'block';
    nextButton.textContent = '다음 문제';
    nextButton.disabled = true;

    // '이전 문제' 버튼 상태 업데이트
    if (prevButton) { // 버튼이 존재할 경우에만 처리
        prevButton.style.display = 'block'; // 버튼 표시
        prevButton.disabled = (currentQuestionIndex === 0); // 첫 번째 문제일 때 비활성화
    }
	
    // 해설 입력 필드 초기화 및 임시 저장된 해설 불러오기
    newExplanationInput.value = getTemporaryExplanation(question['연월일'], question['문제번호']).replace(/_/g, ',');

    // 마지막 푼 문제 상태 업데이트 (일반 퀴즈 모드에서만)
    if (!isReviewMode && !isCheckedQuestionsMode) {
        saveLastQuizState(question['연월일'], [...new Set(filteredQuizData.map(q => q['과목']))], currentQuestionIndex);
    }
}

function checkAnswer() {
    const currentQuestion = filteredQuizData[currentQuestionIndex];
    const options = document.querySelectorAll('#options-container label');
    const explanationContainer = document.getElementById('explanation-container');
    const newExplanationSection = document.getElementById('new-explanation-section'); // 해설 입력 섹션
    const nextButton = document.getElementById('next-button');
    const showAnswerButton = document.getElementById('show-answer-button');

    // 사용자가 옵션을 선택하지 않았다면 (선택지 클릭 시 바로 호출되므로 이 경우는 거의 없음)
    if (selectedOption === null) {
        nextButton.disabled = false;
        showAnswerButton.style.display = 'none';
        return;
    }

    const correctAnswerNumber = parseCorrectAnswer(currentQuestion['정답']);
    let isCurrentQuestionCorrect = false; // 현재 문제의 정답 여부

    options.forEach(label => {
        const input = label.querySelector('input[type="radio"]');
        const optionValue = parseInt(input.value);

        input.disabled = true; // 모든 옵션 비활성화
        label.style.cursor = 'default'; // 커서 모양 변경
        label.classList.remove('option-correct', 'option-wrong'); // 기존 스타일 제거 (재확인)

        if (optionValue === correctAnswerNumber) {
            label.classList.add('option-correct'); // 정답 옵션에 스타일 적용
            if (selectedOption === optionValue) {
                isCurrentQuestionCorrect = true; // 선택한 것이 정답이면 true
            }
        } else if (selectedOption === optionValue) { // 선택한 옵션이 오답인 경우
            label.classList.add('option-wrong'); // 오답 옵션에 스타일 적용
        }
    });

    // 점수 및 틀린 문제 목록 업데이트 (최초 정답 확인 시에만)
    if (!currentQuestion.answered) {
        if (isCurrentQuestionCorrect) {
            score++;
            currentQuestion.isCorrect = true; // 정답으로 표시
        } else {
            currentQuestion.isCorrect = false; // 오답으로 표시
            const isAlreadyInIncorrect = incorrectQuestions.some(q =>
                q['연월일'] === currentQuestion['연월일'] &&
                q['과목'] === currentQuestion['과목'] &&
                q['문제번호'] === currentQuestion['문제번호']
            );
            if (!isReviewMode && !isAlreadyInIncorrect) {
                incorrectQuestions.push(currentQuestion);
            }
        }
        currentQuestion.answered = true; // 문제에 'answered' 플래그를 추가하여 중복 채점 방지
    }

    // 해설 표시 - _를 ,로 변경하여 표시
    explanationContainer.innerHTML = `<p><strong>해설:</strong></p><p>${(currentQuestion['해설'] || '해설이 없습니다.').replace(/_/g, ',')}</p>`;
    explanationContainer.style.display = 'block';
    newExplanationSection.style.display = 'block'; // 해설 입력 섹션 표시

    nextButton.disabled = false; // 다음 버튼 활성화
    showAnswerButton.style.display = 'none'; // 정답보기 버튼 숨김 (이미 정답 표시됐으므로)

    // '다음 문제' 대신 '결과보기'로 변경 (마지막 문제일 경우)
    if (currentQuestionIndex === filteredQuizData.length - 1) {
        nextButton.textContent = '결과 보기';
    } else {
        nextButton.textContent = '다음 문제';
    }
}

function prevQuestion() {
    // 첫 번째 문제에서는 더 이상 뒤로 갈 수 없음
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion(filteredQuizData[currentQuestionIndex]);
    } else {
        // 이 메시지는 prevButton.disabled로 인해 일반적으로 표시되지 않음
        alert('현재가 첫 번째 문제입니다.');
    }
}

function nextQuestion() {
    const currentQuestion = filteredQuizData[currentQuestionIndex];

    // **새로운 로직 추가: 현재 문제가 풀이되었는지 확인**
    if (!currentQuestion.answered) {
        alert('현재 문제를 먼저 풀이하거나 정답을 확인해주세요.');
        return; // 다음 문제로 넘어가지 않고 함수 종료
    }

    currentQuestionIndex++;
    if (currentQuestionIndex < filteredQuizData.length) {
        displayQuestion(filteredQuizData[currentQuestionIndex]);
    } else {
        showResult();
    }
}

function showAnswer() {
    const currentQuestion = filteredQuizData[currentQuestionIndex];
    const options = document.querySelectorAll('#options-container label');
    const explanationContainer = document.getElementById('explanation-container');
    const newExplanationSection = document.getElementById('new-explanation-section'); // 해설 입력 섹션
    const showAnswerButton = document.getElementById('show-answer-button');
    const nextButton = document.getElementById('next-button');

    const correctAnswerNumber = parseCorrectAnswer(currentQuestion['정답']);

    options.forEach(label => {
        const input = label.querySelector('input[type="radio"]');
        input.disabled = true;
        label.style.cursor = 'default';
        label.classList.remove('option-correct', 'option-wrong');
    });

    if (correctAnswerNumber !== null) {
        options.forEach(label => {
            const input = label.querySelector('input[type="radio"]');
            const optionValue = parseInt(input.value);
            if (optionValue === correctAnswerNumber) {
                label.classList.add('option-correct');
            }
        });
    }

    // 해설 표시 - _를 ,로 변경하여 표시
    explanationContainer.innerHTML = `<p><strong>해설:</strong></p><p>${(currentQuestion['해설'] || '해설이 없습니다.').replace(/_/g, ',')}</p>`;
    explanationContainer.style.display = 'block';
    newExplanationSection.style.display = 'block'; // 해설 입력 섹션 표시

    showAnswerButton.style.display = 'none';
    nextButton.disabled = false;

    // '정답보기'를 통해 정답을 본 경우, 점수에는 반영하지 않고 틀린 문제로 간주 (틀린 문제 목록에 추가)
    if (!currentQuestion.answered) {
        currentQuestion.answered = true;
        currentQuestion.isCorrect = false; // 정답을 보았으므로 틀린 문제로 간주 (점수 미반영)

        const isAlreadyInIncorrect = incorrectQuestions.some(q =>
            q['연월일'] === currentQuestion['연월일'] &&
            q['과목'] === currentQuestion['과목'] &&
            q['문제번호'] === currentQuestion['문제번호']
        );
        // 리뷰 모드가 아니고 (일반/체크 모드), 이미 목록에 없다면 추가
        if (!isReviewMode && !isAlreadyInIncorrect) {
            incorrectQuestions.push(currentQuestion);
        }
    }

    if (currentQuestionIndex === filteredQuizData.length - 1) {
        nextButton.textContent = '결과 보기';
    } else {
        nextButton.textContent = '다음 문제';
    }
}

function showResult() {
    const scoreDisplay = document.getElementById('score-display');
    const totalQuestions = filteredQuizData.length;
    scoreDisplay.textContent = `${totalQuestions}문제 중 ${score}개 정답! (${(score / totalQuestions * 100).toFixed(1)}%)`;

    const nextRoundButton = document.getElementById('next-round-button');
    const reviewIncorrectButton = document.getElementById('review-incorrect-button');

    // '다음 회차 풀기' 버튼은 항상 표시 (결과 화면에서)
    // 단, 마지막 회차인 경우는 숨김
    const currentRound = filteredQuizData.length > 0 ? filteredQuizData[0]['연월일'] : null;
    const currentRoundIndex = rounds.indexOf(currentRound);

    if (currentRoundIndex !== -1 && currentRoundIndex < rounds.length - 1) {
        nextRoundButton.style.display = 'inline-block';
    } else {
        nextRoundButton.style.display = 'none';
    }

    // '틀린 문제 풀기' 버튼 로직
    if (incorrectQuestions.length > 0) {
        reviewIncorrectButton.style.display = 'inline-block';
    } else {
        reviewIncorrectButton.style.display = 'none';
    }

    // 메인으로 버튼은 항상 표시
    document.getElementById('back-to-main-from-result-button').style.display = 'inline-block';

    showPage('result-page');
    clearLastQuizState(); // 퀴즈가 끝나면 마지막 푼 문제 상태 초기화
}

// 다음 회차 풀기 기능 (결과 화면에서 호출될 때를 고려)
function startNextRoundQuiz(fromResultPage = false) {
    const currentRound = filteredQuizData.length > 0 ? filteredQuizData[0]['연월일'] : null;
    const currentRoundIndex = rounds.indexOf(currentRound);

    if (currentRoundIndex !== -1 && currentRoundIndex < rounds.length - 1) {
        const nextRound = rounds[currentRoundIndex + 1];

        // 이전에 선택했던 과목들을 가져옴 (일반 퀴즈 모드에서 시작했을 때의 과목)
        // filteredQuizData에서 과목 목록을 추출하여 사용
        const subjectsForNextRound = [...new Set(filteredQuizData.map(q => q['과목']))];

        const nextRoundQuestions = allQuizData.filter(q =>
            q['연월일'] === nextRound && subjectsForNextRound.includes(q['과목'])
        );

        if (nextRoundQuestions.length > 0) {
            startQuiz(nextRoundQuestions, false, false); // 다음 회차 퀴즈 시작 (리뷰/체크 모드 아님)
        } else {
            alert(`다음 회차 (${nextRound})에 이전에 선택했던 과목의 문제가 없습니다.`);
            showPage('main-page'); // 문제가 없으면 메인으로 돌아감
        }
    } else {
        alert('다음 회차가 없습니다.');
        showPage('main-page');
    }
}

// 틀린 문제 풀기 기능
function startIncorrectQuiz() {
    if (incorrectQuestions.length > 0) {
        incorrectQuestions.forEach(q => {
            q.answered = false;
            q.isCorrect = false;
        });
        startQuiz(incorrectQuestions, true, false); // 틀린 문제들로 퀴즈 시작 (리뷰 모드, 체크 모드 아님)
    } else {
        alert('틀린 문제가 없습니다.');
        showPage('main-page');
    }
}

// ⭐ 수정: 체크 문제 다시 풀기 기능 (모달을 띄우는 역할)
function startCheckedQuiz() {
    const checkedQuizModal = document.getElementById('checked-quiz-modal');
    if (checkedQuizModal) {
        checkedQuizModal.style.display = 'flex'; // 모달을 보이게 함 (flex로 변경하여 중앙 정렬 활성화)
        // 모달이 열릴 때마다 체크박스 상태 초기화 (필요하다면)
        const checkedSubjectCheckboxes = document.querySelectorAll('#checked-subject-checkboxes-container .subject-checkboxes-wrapper input[name="checkedSubject"]');
        checkedSubjectCheckboxes.forEach(cb => cb.checked = false);
        // '전체 선택' 버튼 텍스트도 초기화
        const toggleCheckedSubjectsButton = document.getElementById('toggle-all-checked-subjects-button');
        if (toggleCheckedSubjectsButton) {
            toggleCheckedSubjectsButton.textContent = '전체 선택';
        }
    }
}

// ⭐ 추가: 체크 문제 모달에서 과목 선택 후 실제 퀴즈를 시작하는 함수
function startCheckedQuizWithSubject() {
    selectedSubjectsForCheckedQuiz = Array.from(document.querySelectorAll('#checked-subject-checkboxes-container .subject-checkboxes-wrapper input[name="checkedSubject"]:checked'))
        .map(cb => cb.value);

    if (selectedSubjectsForCheckedQuiz.length === 0) {
        alert('체크 문제 풀이할 과목을 하나 이상 선택해주세요.');
        return;
    }

    const checkedQuestionsKeys = getCheckedQuestions(); // 로컬 스토리지에서 체크된 문제 키 가져오기
    let checkedQuestionsArray = [];

    // 모든 퀴즈 데이터에서 체크된 문제 중 선택된 과목에 해당하는 문제만 필터링
    for (const q of allQuizData) {
        const key = `${q['연월일']}-${q['문제번호']}`;
        // 로컬 스토리지에 해당 키가 존재하고, 선택된 과목에 포함되면 추가
        if (checkedQuestionsKeys[key] && selectedSubjectsForCheckedQuiz.includes(q['과목'])) {
            checkedQuestionsArray.push(q);
        }
    }

    if (checkedQuestionsArray.length > 0) {
        // 퀴즈 시작 전 모달 닫기
        const checkedQuizModal = document.getElementById('checked-quiz-modal');
        if (checkedQuizModal) {
            checkedQuizModal.style.display = 'none';
        }
        checkedQuestionsArray.forEach(q => {
            q.answered = false;
            q.isCorrect = false;
        });
        startQuiz(checkedQuestionsArray, false, true); // 체크된 문제들로 퀴즈 시작 (리뷰 모드 아님, 체크 모드)
    } else {
        alert('선택한 과목에 해당하는 체크된 문제가 없습니다. 다른 과목을 선택하거나 문제를 체크해주세요.');
        // 모달은 닫지 않고 유지 (다른 과목을 선택할 수 있도록)
    }
}

// 새로 추가: 마지막 푼 문제부터 시작 기능
function continueLastQuiz() {
    const lastState = getLastQuizState();
    if (lastState) {
        const { round, subjects, questionIndex } = lastState;

        // 마지막으로 풀었던 회차와 과목에 해당하는 문제들을 필터링
        const questionsToContinue = allQuizData.filter(q =>
            q['연월일'] === round && subjects.includes(q['과목'])
        );

        if (questionsToContinue.length > 0) {
            // **수정: 마지막 푼 문제의 다음 문제 대신, 그 문제 자체를 다시 시작**
            const startIndex = questionIndex; // 저장된 인덱스 그대로 사용

            if (startIndex < questionsToContinue.length) {
                startQuiz(questionsToContinue, false, false, startIndex);
            } else {
                // 저장된 인덱스가 현재 문제 배열보다 크거나 같으면 (모두 풀었을 경우)
                alert('마지막 푼 회차의 모든 문제를 풀었습니다. 해당 회차의 첫 문제부터 다시 시작합니다.'); // 메시지 변경
                startQuiz(questionsToContinue, false, false, 0); // 해당 회차의 첫 문제부터 다시 시작
            }
        } else {
            alert('마지막으로 푼 문제의 데이터를 찾을 수 없습니다. 처음부터 다시 시작해주세요.');
            clearLastQuizState(); // 유효하지 않은 상태이므로 초기화
            showPage('main-page');
        }
    } else {
        alert('마지막 푼 문제가 없습니다. 새로운 퀴즈를 시작해주세요.');
        showPage('main-page');
    }
}

// 새로 추가: 본문 복사 기능
function copyQuestionContent() {
    // _를 ,로 변경하여 복사
    const currentQuestion = filteredQuizData[currentQuestionIndex];
    if (!currentQuestion) {
        alert('현재 문제 정보가 없어 복사할 수 없습니다.');
        return;
    }
    const questionContent = currentQuestion['문제내용'].replace(/_/g, ',');

    let viewContentFormatted = '';
    // '보기'가 이미지인지 텍스트인지 판단하여 복사 내용 구성
    if (currentQuestion['보기'] && currentQuestion['보기'].trim() !== '') {
        const viewData = currentQuestion['보기'].trim();
        if (viewData.startsWith('images/') && /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(viewData)) {
            viewContentFormatted = `[보기 이미지: ${window.location.origin}/${viewData}]`; // 이미지 경로 포함
        } else {
            viewContentFormatted = viewData.replace(/_/g, ',');
        }
    }

    let optionsText = '';
    for (let i = 1; i <= 4; i++) {
        const optionKey = `선택지${i}`;
        const optionData = currentQuestion[optionKey];
        if (optionData !== null && typeof optionData !== 'undefined' && optionData.trim() !== '') {
            if (optionData.startsWith('images/') && /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(optionData.trim())) {
                optionsText += `${i}. [선택지 이미지: ${window.location.origin}/${optionData.trim()}]\n`;
            } else {
                optionsText += `${i}. ${optionData.replace(/_/g, ',')}\n`;
            }
        }
    }

    // 보기가 있을 경우에만 줄바꿈 두 번 추가
    const fullContent = `[${currentQuestion['연월일']}-${currentQuestion['문제번호']}번] ${questionContent}` +
        (viewContentFormatted ? '\n\n<보기>\n' + viewContentFormatted : '') +
        (optionsText ? '\n\n' + optionsText.trim() : ''); // 마지막 줄바꿈 제거

    navigator.clipboard.writeText(fullContent)
        .then(() => {
            alert('문제 내용이 클립보드에 복사되었습니다.');
        })
        .catch(err => {
            console.error('클립보드 복사 실패:', err);
            alert('클립보드 복사에 실패했습니다. 브라우저 설정을 확인해주세요.');
        });
}

// 특정 문제에 임시 저장된 해설을 불러오는 함수
function getTemporaryExplanation(round, questionNumber) {
    const tempExplanations = getTemporaryExplanations();
    const key = `${round}-${questionNumber}`;
    return tempExplanations[key] || ''; // 없으면 빈 문자열 반환
}

// --- 이벤트 리스너 설정 함수 (setupEventListeners는 가장 마지막에 위치) ---
function setupEventListeners() {
    document.getElementById('start-quiz-button').addEventListener('click', () => startQuiz()); // 일반 퀴즈 시작
    document.getElementById('start-checked-quiz-button').addEventListener('click', startCheckedQuiz); // 체크 문제 시작 (모달 띄움)

    // ⭐ 추가: 체크 문제 모달 관련 이벤트 리스너
    const checkedQuizModal = document.getElementById('checked-quiz-modal');
    if (checkedQuizModal) {
        document.getElementById('confirm-checked-quiz-start').addEventListener('click', startCheckedQuizWithSubject);
        // 모달 닫기 버튼
        const closeButton = checkedQuizModal.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                checkedQuizModal.style.display = 'none';
            });
        }
        // 모달 외부 클릭 시 닫기
        window.addEventListener('click', (event) => {
            if (event.target === checkedQuizModal) {
                checkedQuizModal.style.display = 'none';
            }
        });
    }

    document.getElementById('continue-last-quiz-button').addEventListener('click', continueLastQuiz); // 마지막 푼 문제부터 시작

    document.getElementById('next-button').addEventListener('click', nextQuestion);
    document.getElementById('show-answer-button').addEventListener('click', showAnswer);
    document.getElementById('copy-question-button').addEventListener('click', copyQuestionContent); // 본문 복사 기능
	
	// '이전 문제' 버튼 이벤트 리스너 추가
    const prevButton = document.getElementById('prev-button');
    if (prevButton) { // 버튼이 HTML에 추가되었는지 확인 후 리스너 등록
        prevButton.addEventListener('click', prevQuestion);
    }
	
    document.getElementById('back-to-main-button').addEventListener('click', () => {
        populateMainPage();
        showPage('main-page');
        updateContinueLastQuizButton();
    });

    // 결과 페이지 버튼 리스너
    document.getElementById('next-round-button').addEventListener('click', () => startNextRoundQuiz(true));
    document.getElementById('review-incorrect-button').addEventListener('click', startIncorrectQuiz);
    document.getElementById('back-to-main-from-result-button').addEventListener('click', () => {
        populateMainPage();
        showPage('main-page');
        updateContinueLastQuizButton();
    });

    // '전체 선택/해제' 버튼 리스너
    document.getElementById('toggle-all-subjects-button').addEventListener('click', toggleAllSubjects);
    // ⭐ 체크 문제용 '전체 선택/해제' 버튼 리스너는 populateCheckedQuizSubjectSelection에서 동적으로 생성될 때 추가되므로, 여기서 직접 추가하지 않습니다.

    // 해설 관련 버튼 리스너
    document.getElementById('save-explanation-button').addEventListener('click', saveTemporaryExplanation);
    document.getElementById('export-explanations-button').addEventListener('click', exportTemporaryExplanations);
    document.getElementById('clear-temp-explanations-button').addEventListener('click', clearTemporaryExplanations);
	
	// 체크 문제 내보내기/가져오기 버튼 리스너 추가
    const exportCheckedButton = document.getElementById('export-checked-questions-button');
    if (exportCheckedButton) {
        exportCheckedButton.addEventListener('click', exportCheckedQuestions);
    }

    const importCheckedButton = document.getElementById('import-checked-questions-button');
    if (importCheckedButton) {
        importCheckedButton.addEventListener('click', importCheckedQuestions);
    }

    const importFileInput = document.getElementById('import-checked-file-input');
    if (importFileInput) {
        importFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    processImportedCheckedQuestions(e.target.result);
                };
                reader.readAsText(file);
            }
        });
    }
}

// --- 체크 문제 내보내기/가져오기 함수 ---
function exportCheckedQuestions() {
    const checkedQuestions = getCheckedQuestions(); // 현재 체크된 문제 데이터 가져오기
    const dataToExport = JSON.stringify(checkedQuestions, null, 2); // 보기 좋게 JSON 형식으로 변환

    if (Object.keys(checkedQuestions).length === 0) {
        alert('체크된 문제가 없습니다.');
        return;
    }

    // 클립보드에 복사
    navigator.clipboard.writeText(dataToExport)
        .then(() => {
            alert('체크된 문제 목록이 클립보드에 복사되었습니다.');
        })
        .catch(err => {
            console.error('클립보드 복사 실패:', err);
            alert('클립보드 복사에 실패했습니다. 브라우저 설정을 확인해주세요.');
        });

    // 또는 파일로 다운로드 (선택 사항)
    // const blob = new Blob([dataToExport], { type: 'application/json' });
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = 'checked_questions.json';
    // document.body.appendChild(a);
    // a.click();
    // document.body.removeChild(a);
    // URL.revokeObjectURL(url);
}

function importCheckedQuestions() {
    // 사용자에게 JSON 데이터를 입력받는 방법:
    // 1. 텍스트 프롬프트 (간단하지만 대용량 데이터는 불편)
    // 2. 파일 업로드 (더 일반적이고 편리)
    // 3. 텍스트 에어리어 (프롬프트보다 낫지만 여전히 수동)

    // 여기서는 파일 업로드 방식을 제안합니다.
    const fileInput = document.getElementById('import-checked-file-input');
    if (fileInput) {
        fileInput.click(); // 숨겨진 파일 입력 버튼 클릭 유도
    } else {
        // 파일 입력 요소가 없는 경우를 대비한 대체 (예: prompt)
        const jsonString = prompt('여기에 체크된 문제 JSON 데이터를 붙여넣으세요:\n(기존 데이터에 덮어씌워집니다.)');
        if (jsonString) {
            processImportedCheckedQuestions(jsonString);
        }
    }
}

function processImportedCheckedQuestions(jsonString) {
    try {
        const importedData = JSON.parse(jsonString);

        if (typeof importedData !== 'object' || Array.isArray(importedData)) {
            throw new Error('가져온 데이터가 유효한 JSON 객체 형식이 아닙니다.');
        }

        // 기존 데이터에 병합할지, 덮어씌울지 선택 가능
        if (confirm('기존 체크된 문제를 가져온 데이터로 덮어씌우시겠습니까? (취소 시 병합됩니다)')) {
            localStorage.setItem(CHECKED_QUESTIONS_KEY, JSON.stringify(importedData));
            alert('체크된 문제가 성공적으로 덮어씌워졌습니다.');
        } else {
            // 병합 로직: 기존 데이터에 새로운 데이터 추가
            const existingChecked = getCheckedQuestions();
            const mergedData = { ...existingChecked, ...importedData };
            localStorage.setItem(CHECKED_QUESTIONS_KEY, JSON.stringify(mergedData));
            alert('체크된 문제가 성공적으로 병합되었습니다.');
        }

        // 가져오기 후 UI 업데이트 필요 시 호출
        // 예: 메인 페이지의 '체크 문제 다시 풀기' 버튼에 영향을 줄 수 있음
        populateCheckedQuizSubjectSelection(); // 체크 문제 모달의 과목 선택 UI 갱신
        updateContinueLastQuizButton(); // 마지막 푼 문제 상태가 영향을 받을 수 있으므로 갱신
    } catch (e) {
        alert('잘못된 JSON 형식의 데이터입니다. 데이터를 확인해주세요.\n오류: ' + e.message);
        console.error('체크된 문제 가져오기 오류:', e);
    }
}