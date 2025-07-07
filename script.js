// 전역 변수 선언
let allQuizData = []; // 모든 퀴즈 데이터를 저장할 배열
let filteredQuizData = []; // 선택된 회차 및 과목에 따라 필터링된 퀴즈 데이터
let rounds = []; // 사용 가능한 모든 회차 (연월일)
let availableSubjects = []; // 사용 가능한 모든 과목
let currentQuestionIndex = 0; // 현재 풀고 있는 문제의 인덱스
let score = 0; // 점수
let selectedOption = null; // 사용자가 선택한 옵션을 저장할 변수
let incorrectQuestions = []; // 틀린 문제들을 저장할 배열
let isReviewMode = false; // 틀린 문제 풀기 모드인지 여부

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
    document.getElementById('start-quiz-button').addEventListener('click', startQuiz);
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


function startQuiz(quizQuestions = null, isReview = false) {
    let quizToStart = [];
    let selectedRound = '';
    let selectedSubjects = [];

    incorrectQuestions = []; // 새 퀴즈 시작 시 틀린 문제 목록 초기화
    isReviewMode = isReview; // 리뷰 모드 설정

    if (quizQuestions && Array.isArray(quizQuestions)) { // 틀린 문제 풀기 또는 다음 회차 풀기 (이미 필터링된 문제 배열을 받음)
        quizToStart = quizQuestions;
        // 리뷰 모드일 경우 현재 회차/과목 정보는 틀린 문제의 첫 번째 문제 기준으로 표시
        if (quizQuestions.length > 0) {
            selectedRound = quizQuestions[0]['연월일'];
            // 틀린 문제 풀이 시에는 과목 선택 상태를 유지할 필요가 없으므로 해당 코드는 제거
            // selectedSubjects = [...new Set(quizQuestions.map(q => q['과목']))];
        }
    } else { // 메인 페이지에서 '퀴즈 시작' 버튼 클릭 시
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
        // 만약 빈 배열이면 메인 페이지로 돌아가거나 적절한 처리를 해야 함
        showPage('main-page'); // 메인 페이지로 복귀
        return;
    }

    // *** 수정된 부분: quizToStart가 배열임을 확실히 하고 sort 호출 ***
    if (Array.isArray(quizToStart)) { // quizToStart가 배열인지 다시 한 번 확인
        quizToStart.sort((a, b) => parseInt(a['문제번호']) - parseInt(b['문제번호']));
    } else {
        console.error("오류: quizToStart가 배열이 아닙니다.", quizToStart);
        alert("퀴즈 문제를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.");
        showPage('main-page');
        return;
    }
    // *** 수정된 부분 끝 ***

    filteredQuizData = quizToStart; // 현재 풀이할 문제 목록 설정
    currentQuestionIndex = 0;
    score = 0;
    filteredQuizData.forEach(q => {
        q.answered = false; // 문제 풀이 여부 초기화
        q.isCorrect = false; // 정답 여부 초기화 (틀린 문제 풀기 시 필요)
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

    // 유니코드 원문자(①, ②, ③, ④)를 숫자(1, 2, 3, 4)로 매핑
    const unicodeMap = {
        '①': 1, '②': 2, '③': 3, '④': 4
    };

    if (unicodeMap[answerString.trim()]) { // 공백 제거 후 맵에서 찾기
        return unicodeMap[answerString.trim()];
    }

    // 일반 숫자 문자열 '1', '2', '3', '4' 처리
    const parsedNum = parseInt(answerString.trim()); // 공백 제거 후 파싱
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

    optionsContainer.innerHTML = '';
    explanationContainer.innerHTML = '';
    explanationContainer.style.display = 'none';
    selectedOption = null;

    currentQuizInfoEl.textContent = `회차: ${question['연월일']} | 과목: ${question['과목']} | 문제번호: ${question['문제번호']}`;
    quizQuestionEl.textContent = question['문제내용'];
    quizViewEl.textContent = question['보기'] || '';

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

function checkAnswer() { // isSubmitButtonClicked 매개변수 제거
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
            // 단, 이미 틀린 문제 풀이 모드이거나 (isReviewMode), 이미 목록에 있다면 추가하지 않음
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

    // 모든 옵션 비활성화 및 기존 스타일 제거
    options.forEach(label => {
        const input = label.querySelector('input[type="radio"]');
        input.disabled = true;
        label.style.cursor = 'default';
        label.classList.remove('option-correct', 'option-wrong');
    });

    // 정답 옵션에 스타일 적용
    if (correctAnswerNumber !== null) {
        options.forEach(label => {
            const input = label.querySelector('input[type="radio"]');
            const optionValue = parseInt(input.value);
            if (optionValue === correctAnswerNumber) {
                label.classList.add('option-correct');
            }
        });
    }

    // 해설 표시
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
    
    // 결과 페이지 버튼 표시/숨김 로직
    const nextRoundButton = document.getElementById('next-round-button');
    const reviewIncorrectButton = document.getElementById('review-incorrect-button');
    
    // '다음 회차 풀기' 버튼 로직
    const currentRound = filteredQuizData.length > 0 ? filteredQuizData[0]['연월일'] : null;
    const currentRoundIndex = rounds.indexOf(currentRound);
    
    if (currentRoundIndex !== -1 && currentRoundIndex < rounds.length - 1) {
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

        // 만약 메인 페이지에서 선택된 과목이 없다면, 현재 퀴즈의 과목을 사용
        const subjectsForNextRound = selectedSubjects.length > 0 
                                     ? selectedSubjects 
                                     : [...new Set(filteredQuizData.map(q => q['과목']))];
        
        // 다음 회차의 해당 과목 문제들을 필터링
        const nextRoundQuestions = allQuizData.filter(q =>
            q['연월일'] === nextRound && subjectsForNextRound.includes(q['과목'])
        );

        if (nextRoundQuestions.length > 0) {
            startQuiz(nextRoundQuestions, false); // 다음 회차 퀴즈 시작 (리뷰 모드 아님)
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
        // 틀린 문제들을 다시 풀기 위해 초기화
        incorrectQuestions.forEach(q => {
            q.answered = false; // 다시 풀기 위해 answered 상태 초기화
            q.isCorrect = false; // 다시 풀기 위해 isCorrect 상태 초기화
        });
        // 틀린 문제를 다시 풀 때, `filteredQuizData`를 `incorrectQuestions`로 설정
        // `startQuiz` 함수가 이 배열을 사용하여 퀴즈를 시작
        startQuiz(incorrectQuestions, true); // 틀린 문제들로 퀴즈 시작 (리뷰 모드)
    } else {
        alert('틀린 문제가 없습니다.');
        showPage('main-page'); // 틀린 문제가 없으면 메인으로 돌아감
    }
}
