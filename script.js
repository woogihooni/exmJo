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

// 로컬 스토리지 키 (체크된 문제 저장용)
const CHECKED_QUESTIONS_KEY = 'checkedQuestions'; // { 'YYYYMMDD-문제번호': true } 형태

// 페이지 로드 시 초기화 함수 호출
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadQuizData(); // 퀴즈 데이터 로드
    setupEventListeners(); // 이벤트 리스너 설정
    showPage('main-page'); // 메인 페이지 표시
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

function setupEventListeners() {
    document.getElementById('start-quiz-button').addEventListener('click', () => startQuiz()); // 일반 퀴즈 시작
    document.getElementById('start-checked-quiz-button').addEventListener('click', startCheckedQuiz); // 새로 추가: 체크 문제 퀴즈 시작

    document.getElementById('next-button').addEventListener('click', nextQuestion);
    document.getElementById('show-answer-button').addEventListener('click', showAnswer);
    document.getElementById('back-to-main-button').addEventListener('click', () => showPage('main-page'));

    // 결과 페이지 버튼 리스너
    document.getElementById('next-round-button').addEventListener('click', startNextRoundQuiz);
    document.getElementById('review-incorrect-button').addEventListener('click', startIncorrectQuiz);
    document.getElementById('back-to-main-from-result-button').addEventListener('click', () => {
        // 메인 페이지로 돌아갈 때 과목 선택 상태 초기화
        populateMainPage(); // 과목 체크박스들을 다시 생성하며 기본적으로 해제 상태로 만듦
        showPage('main-page');
    });

    // '전체 선택/해제' 버튼 리스너
    document.getElementById('toggle-all-subjects-button').addEventListener('click', toggleAllSubjects);
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    document.getElementById(pageId).style.display = 'block';
}

// '전체 선택/해제' 버튼 토글 로직
function toggleAllSubjects() {
    const subjectCheckboxes = document.querySelectorAll('#subject-checkboxes-container input[type="checkbox"]');
    const toggleButton = document.getElementById('toggle-all-subjects-button');
    
    // 현재 모든 체크박스가 선택되어 있는지 확인
    const allCurrentlyChecked = Array.from(subjectCheckboxes).every(cb => cb.checked);

    subjectCheckboxes.forEach(checkbox => {
        checkbox.checked = !allCurrentlyChecked; // 현재 상태의 반대로 설정
    });

    // 버튼 텍스트 변경
    toggleButton.textContent = allCurrentlyChecked ? '전체 선택' : '전체 해제';
}

// --- 로컬 스토리지 관련 함수 ---
function getCheckedQuestions() {
    const data = localStorage.getItem(CHECKED_QUESTIONS_KEY);
    return data ? JSON.parse(data) : {}; // { 'YYYYMMDD-문제번호': true } 형태
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
// --- 로컬 스토리지 관련 함수 끝 ---


// 퀴즈 시작 함수 (다양한 모드 지원)
function startQuiz(quizQuestions = null, isReview = false, isChecked = false) {
    let quizToStart = [];
    let selectedRound = '';
    // let selectedSubjects = []; // 퀴즈 정보 표시용으로만 사용 (필터링에는 사용 안 됨)

    incorrectQuestions = []; // 새 퀴즈 시작 시 틀린 문제 목록 초기화
    isReviewMode = isReview; // 틀린 문제 풀이 모드 설정
    isCheckedQuestionsMode = isChecked; // 체크 문제 풀이 모드 설정

    if (quizQuestions && Array.isArray(quizQuestions)) { // 틀린/체크 문제 풀기 모드
        quizToStart = quizQuestions;
        if (quizToStart.length > 0) {
            selectedRound = quizToStart[0]['연월일'];
            // selectedSubjects = [...new Set(quizToStart.map(q => q['과목']))]; // 퀴즈 정보 표시를 위함
        }
    } else { // 일반 퀴즈 시작 (메인 페이지에서)
        selectedRound = document.getElementById('round-select').value;
        const selectedSubjects = Array.from(document.querySelectorAll('input[name="subject"]:checked'))
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
        showPage('main-page'); // 문제가 없으면 메인 페이지로 복귀
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
    currentQuestionIndex = 0;
    score = 0;
    // 각 문제의 풀이 상태 및 정답 여부 초기화
    filteredQuizData.forEach(q => {
        q.answered = false; 
        q.isCorrect = false; 
    });
    
    showPage('quiz-page');
    displayQuestion(filteredQuizData[currentQuestionIndex]);
}

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

function displayQuestion(question) {
    const quizQuestionEl = document.getElementById('question-content');
    const quizViewEl = document.getElementById('view-content');
    const optionsContainer = document.getElementById('options-container');
    const explanationContainer = document.getElementById('explanation-container');
    const currentQuizInfoEl = document.getElementById('current-quiz-info');
    const nextButton = document.getElementById('next-button');
    const showAnswerButton = document.getElementById('show-answer-button');
    const questionCheckbox = document.getElementById('question-checkbox'); // 체크박스 요소

    optionsContainer.innerHTML = '';
    explanationContainer.innerHTML = '';
    explanationContainer.style.display = 'none';
    selectedOption = null; // 선택된 옵션 초기화

    currentQuizInfoEl.textContent = `회차: ${question['연월일']} | 과목: ${question['과목']} | 문제번호: ${question['문제번호']}`;
    quizQuestionEl.textContent = question['문제내용'];
    quizViewEl.textContent = question['보기'] || '';

    // 문제 체크박스 상태 업데이트 및 이벤트 리스너 재설정
    questionCheckbox.checked = isQuestionChecked(question['연월일'], question['문제번호']);
    // 기존에 추가된 이벤트 리스너를 제거하고 새로 추가하여 중복 방지
    questionCheckbox.onchange = null; // 기존 onchange 이벤트 핸들러 제거
    questionCheckbox.onchange = (event) => { 
        if (event.target.checked) {
            saveCheckedQuestion(question['연월일'], question['문제번호']);
        } else {
            removeCheckedQuestion(question['연월일'], question['문제번호']);
        }
    };

    // 선택지 동적 생성
    for (let i = 1; i <= 4; i++) {
        const optionKey = `선택지${i}`;
        const optionText = question[optionKey];
        if (optionText !== null && typeof optionText !== 'undefined') {
            const label = document.createElement('label');
            label.classList.remove('option-correct', 'option-wrong'); // 기존 스타일 제거
            label.innerHTML = `<input type="radio" name="option" value="${i}"> ${optionText}`;
            optionsContainer.appendChild(label);

            label.querySelector('input[type="radio"]').addEventListener('change', function() {
                selectedOption = parseInt(this.value);
                checkAnswer(); // 선택지 클릭 시 바로 정답 확인
            });
        }
    }

    nextButton.style.display = 'block';
    showAnswerButton.style.display = 'block';
    nextButton.textContent = '다음 문제';
    nextButton.disabled = true; // 정답 확인 전까지 다음 버튼 비활성화
}

function checkAnswer() {
    const currentQuestion = filteredQuizData[currentQuestionIndex];
    const options = document.querySelectorAll('#options-container label');
    const explanationContainer = document.getElementById('explanation-container');
    const nextButton = document.getElementById('next-button');
    const showAnswerButton = document.getElementById('show-answer-button');

    // 사용자가 옵션을 선택하지 않았다면 (선택지 클릭 시 바로 호출되므로 이 경우는 거의 없음)
    if (selectedOption === null) {
        // 이 경로는 선택지 클릭 시 바로 호출되므로 거의 발생하지 않음
        // 그래도 혹시 모를 경우를 대비하여 다음 버튼 활성화
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
            // 틀린 문제만 다시 풀기 위해 틀린 문제 목록에 추가
            // 단, 리뷰 모드가 아니고 (일반/체크 모드), 이미 목록에 없다면 추가
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

    // 해설 표시
    explanationContainer.innerHTML = `<p><strong>해설:</strong></p><p>${currentQuestion['해설'] || '해설이 없습니다.'}</p>`;
    explanationContainer.style.display = 'block';

    nextButton.disabled = false; // 다음 버튼 활성화
    showAnswerButton.style.display = 'none'; // 정답보기 버튼 숨김 (이미 정답 표시됐으므로)

    // '다음 문제' 대신 '결과보기'로 변경 (마지막 문제일 경우)
    if (currentQuestionIndex === filteredQuizData.length - 1) {
        nextButton.textContent = '결과 보기';
    } else {
        nextButton.textContent = '다음 문제';
    }
}

function nextQuestion() {
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

    explanationContainer.innerHTML = `<p><strong>해설:</strong></p><p>${currentQuestion['해설'] || '해설이 없습니다.'}</p>`;
    explanationContainer.style.display = 'block';

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
    
    // '다음 회차 풀기' 버튼 로직: 일반 퀴즈 모드에서만 활성화 (체크/오답 풀이 모드 아님)
    const currentRound = filteredQuizData.length > 0 ? filteredQuizData[0]['연월일'] : null;
    const currentRoundIndex = rounds.indexOf(currentRound);
    
    if (!isReviewMode && !isCheckedQuestionsMode && currentRoundIndex !== -1 && currentRoundIndex < rounds.length - 1) {
        nextRoundButton.style.display = 'inline-block'; // 다음 회차가 있으면 버튼 표시
    } else {
        nextRoundButton.style.display = 'none'; // 없으면 숨김
    }

    // '틀린 문제 풀기' 버튼 로직
    if (incorrectQuestions.length > 0) {
        reviewIncorrectButton.style.display = 'inline-block';
    } else {
        reviewIncorrectButton.style.display = 'none';
    }

    // 결과 페이지에서 '메인으로' 버튼은 항상 표시
    document.getElementById('back-to-main-from-result-button').style.display = 'inline-block';

    showPage('result-page');
}

// 다음 회차 풀기 기능
function startNextRoundQuiz() {
    const currentRound = filteredQuizData.length > 0 ? filteredQuizData[0]['연월일'] : null;
    const currentRoundIndex = rounds.indexOf(currentRound);

    if (currentRoundIndex !== -1 && currentRoundIndex < rounds.length - 1) {
        const nextRound = rounds[currentRoundIndex + 1];
        
        // 현재 메인 페이지의 과목 선택 상태를 가져옴
        const selectedSubjects = Array.from(document.querySelectorAll('#subject-checkboxes-container input[name="subject"]:checked'))
                                    .map(cb => cb.value);

        // 만약 메인 페이지에서 선택된 과목이 없다면, 현재 퀴즈의 과목을 유지하여 다음 회차 문제 필터링
        const subjectsForNextRound = selectedSubjects.length > 0 
                                     ? selectedSubjects 
                                     : [...new Set(filteredQuizData.map(q => q['과목']))];
        
        const nextRoundQuestions = allQuizData.filter(q =>
            q['연월일'] === nextRound && subjectsForNextRound.includes(q['과목'])
        );

        if (nextRoundQuestions.length > 0) {
            startQuiz(nextRoundQuestions, false, false); // 다음 회차 퀴즈 시작 (리뷰/체크 모드 아님)
        } else {
            alert(`다음 회차 (${nextRound})에 선택된 과목의 문제가 없습니다.`);
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
        // 틀린 문제들을 다시 풀기 위해 answered 및 isCorrect 상태 초기화
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

// 새로 추가: 체크 문제 다시 풀기 기능
function startCheckedQuiz() {
    const checkedQuestionsKeys = getCheckedQuestions(); // 로컬 스토리지에서 체크된 문제 키 가져오기
    const checkedQuestionsArray = [];

    // 모든 퀴즈 데이터에서 체크된 문제만 필터링하여 배열로 만듦
    for (const q of allQuizData) {
        const key = `${q['연월일']}-${q['문제번호']}`;
        if (checkedQuestionsKeys[key]) { // 로컬 스토리지에 해당 키가 존재하면
            checkedQuestionsArray.push(q);
        }
    }

    if (checkedQuestionsArray.length > 0) {
        // 체크된 문제들은 원래 정답 여부나 풀이 여부를 리셋해야 하므로 초기화
        checkedQuestionsArray.forEach(q => {
            q.answered = false;
            q.isCorrect = false;
        });
        startQuiz(checkedQuestionsArray, false, true); // 체크된 문제들로 퀴즈 시작 (리뷰 모드 아님, 체크 모드)
    } else {
        alert('체크된 문제가 없습니다. 먼저 문제를 체크해주세요.');
        showPage('main-page'); // 체크된 문제가 없으면 메인으로 돌아감
    }
}
