/**
 * Binglish — Placement Test Module
 * Test de nivel de inglés con 60 preguntas reales.
 * Las respuestas se validan EXCLUSIVAMENTE en el backend.
 */

// ══════════════════════════════════════════════
//  QUESTION BANK — 60 preguntas reales
//  ⚠ SIN RESPUESTAS — se validan en el servidor
// ══════════════════════════════════════════════

const TEST_QUESTIONS = [
  // ── SECTION 1: GRAMMAR (1–25) ──

  // A1 Level (1-8)
  { q: 'She ___ from Bolivia.', options: ['are', 'is', 'am', 'be'] },
  { q: 'They ___ soccer every weekend.', options: ['plays', 'playing', 'play', 'played'] },
  { q: '___ you like pizza?', options: ['Do', 'Does', 'Are', 'Is'] },
  { q: 'My brother ___ a student.', options: ['are', 'am', 'is', 'be'] },
  { q: 'There ___ two books on the table.', options: ['is', 'are', 'am', 'be'] },
  { q: 'I ___ TV yesterday.', options: ['watch', 'watched', 'watches', 'watching'] },
  { q: 'She ___ coffee every morning.', options: ['drink', 'drinks', 'drank', 'drinking'] },
  { q: 'We ___ to school now.', options: ['go', 'went', 'are going', 'goes'] },

  // A2 Level (9-16)
  { q: 'I have lived here ___ 2020.', options: ['for', 'since', 'ago', 'from'] },
  { q: 'They ___ dinner when I arrived.', options: ['had', 'have', 'were having', 'are having'] },
  { q: 'If it rains, we ___ home.', options: ['stay', 'stayed', 'will stay', 'staying'] },
  { q: 'She has ___ finished her homework.', options: ['yet', 'already', 'never', 'tomorrow'] },
  { q: 'This book is ___ than that one.', options: ['interesting', 'more interesting', 'most interesting', 'interest'] },
  { q: 'I ___ to Brazil last year.', options: ['go', 'gone', 'went', 'going'] },
  { q: "There isn't ___ milk in the fridge.", options: ['many', 'much', 'few', 'any of'] },
  { q: 'How long ___ you studied English?', options: ['did', 'have', 'are', 'do'] },

  // B1 Level (17-25)
  { q: 'By the time we arrived, the movie ___.', options: ['starts', 'started', 'had started', 'has started'] },
  { q: 'If I ___ more money, I would travel more.', options: ['have', 'had', 'will have', 'would have'] },
  { q: 'She asked me where ___.', options: ['was I going', 'I was going', 'am I going', 'I am going'] },
  { q: 'He ___ in this company for five years before he moved.', options: ['worked', 'has worked', 'had worked', 'works'] },
  { q: 'The book ___ by a famous author.', options: ['wrote', 'was written', 'is writing', 'writes'] },
  { q: "I'm interested ___ learning Japanese.", options: ['at', 'in', 'on', 'for'] },
  { q: 'If she had studied harder, she ___ the exam.', options: ['passed', 'would pass', 'would have passed', 'will pass'] },
  { q: 'Neither John nor his friends ___ coming tonight.', options: ['is', 'are', 'was', 'be'] },
  { q: 'The teacher suggested ___ earlier.', options: ['arrive', 'arrived', 'arriving', 'to arriving'] },

  // ── SECTION 2: USE OF ENGLISH (26–40) ──
  { q: 'Choose the correct sentence.', options: ["She don't like coffee.", "She doesn't likes coffee.", "She doesn't like coffee.", 'She not like coffee.'] },
  { q: '"Where are you from?"', options: ["I'm from Bolivia.", 'I from Bolivia.', 'From Bolivia.', 'I be Bolivia.'] },
  { q: '"Would you like some tea?"', options: ['Yes, I would.', 'Yes, please.', 'Yes, I like.', 'Yes, I do like.'] },
  { q: 'Choose the correct sentence.', options: ['He can sings very well.', 'He cans sing very well.', 'He can sing very well.', 'He can to sing very well.'] },
  { q: '"I lost my keys."', options: ["That's great!", 'Congratulations!', "I'm sorry to hear that.", 'Well done!'] },
  { q: "I'm looking forward ___ you.", options: ['see', 'to see', 'to seeing', 'seeing'] },
  { q: 'Which sentence is correct?', options: ['She has never been to Peru.', 'She never has been to Peru.', 'Never she has been to Peru.', 'She has been never to Peru.'] },
  { q: "He's the boy ___ won the competition.", options: ['which', 'who', 'where', 'whose'] },
  { q: "You ___ smoke here. It's prohibited.", options: ['must', "mustn't", 'should', 'can'] },
  { q: 'Which sentence is formal?', options: ['Gimme the report.', 'Can you send me the report, please?', 'Send me that now.', 'Hey you, report!'] },
  { q: 'She ___ her homework before dinner.', options: ['usually finishes', 'finishes usually', 'finish usually', 'usually finish'] },
  { q: "I don't have ___ friends in this city.", options: ['much', 'many', 'little', 'any of'] },
  { q: 'The opposite of "cheap" is:', options: ['small', 'expensive', 'noisy', 'difficult'] },
  { q: '"Turn on" means:', options: ['stop', 'activate', 'remove', 'clean'] },
  { q: 'Which sentence is grammatically correct?', options: ['If I will see him, I tell him.', 'If I see him, I will tell him.', 'If I saw him, I will tell him.', 'If I seen him, I tell him.'] },

  // ── SECTION 3: VOCABULARY & ANTONYMS (41–50) ──
  { q: 'The antonym of "happy" is:', options: ['tired', 'sad', 'hungry', 'friendly'] },
  { q: 'The antonym of "easy" is:', options: ['difficult', 'simple', 'light', 'soft'] },
  { q: '"Teacher" is related to:', options: ['hospital', 'school', 'airport', 'police station'] },
  { q: 'The synonym of "big" is:', options: ['tiny', 'huge', 'short', 'weak'] },
  { q: 'The opposite of "early" is:', options: ['fast', 'late', 'slow', 'soon'] },
  { q: 'A person who designs buildings is an:', options: ['engineer', 'accountant', 'architect', 'dentist'] },
  { q: 'The antonym of "noisy" is:', options: ['quiet', 'crowded', 'modern', 'empty'] },
  { q: '"Delicious" describes:', options: ['weather', 'food', 'music', 'transportation'] },
  { q: 'The opposite of "strong" is:', options: ['heavy', 'weak', 'brave', 'young'] },
  { q: '"Borrow" means:', options: ['give something permanently', 'take something for a short time', 'break something', 'buy something expensive'] },

  // ── SECTION 4: READING COMPREHENSION (51–60) ──
  // Reading Text 1 (51-55)
  { q: 'Where does Maria live?', options: ['Brazil', 'Peru', 'La Paz', 'Chile'], reading: 1 },
  { q: 'What does Maria study?', options: ['French', 'English', 'Math', 'History'], reading: 1 },
  { q: 'Where does she work?', options: ['At a school', 'At a bank', 'In a café', 'In a hospital'], reading: 1 },
  { q: 'What did she do last Saturday?', options: ['Stayed home', 'Went shopping', 'Went to the cinema', 'Played soccer'], reading: 1 },
  { q: 'What kind of movie did she watch?', options: ['Romantic', 'Horror', 'Comedy', 'Action'], reading: 1 },

  // Reading Text 2 (56-60)
  { q: 'What is the main topic of the text?', options: ['Transportation', 'Technology and communication', 'Sports activities', 'Environmental problems'], reading: 2 },
  { q: 'According to the text, many people prefer:', options: ['writing letters', 'visiting friends', 'messaging applications', 'radio communication'], reading: 2 },
  { q: 'Some experts believe technology can:', options: ['improve cooking skills', 'reduce social interaction', 'increase pollution', 'create jobs only'], reading: 2 },
  { q: 'Others think technology:', options: ['limits communication', 'is unnecessary', 'creates more communication opportunities', 'should disappear'], reading: 2 },
  { q: 'The word "affect" is closest in meaning to:', options: ['improve', 'influence', 'destroy', 'forget'], reading: 2 },
];

// Reading texts for comprehension section
const READING_TEXTS = {
  1: `Maria is 22 years old and lives in La Paz. She studies English at an academy in the evenings. During the day, she works in a café near her house. She likes listening to music and watching movies with her friends on weekends. Last Saturday, she went to the cinema and watched an action movie. She really enjoyed it.`,
  2: `Technology has changed the way people communicate. Nowadays, many people use messaging applications instead of making phone calls. While technology helps people stay connected, some experts believe it can reduce face-to-face interaction and affect social skills. Others argue that technology creates more opportunities for communication, especially for people who live far away from family and friends.`
};

// Page structure (4 pages)
const TEST_PAGES = [
  { title: 'Grammar — A1 & A2', start: 0, end: 16 },
  { title: 'Grammar — B1', start: 16, end: 25 },
  { title: 'Use of English', start: 25, end: 40 },
  { title: 'Vocabulary & Reading', start: 40, end: 60 },
];

const TOTAL_QUESTIONS = TEST_QUESTIONS.length;
const TOTAL_PAGES = TEST_PAGES.length;

let testCurrentPage = 0;
let testAnswers = new Array(TOTAL_QUESTIONS).fill(-1); // -1 = sin responder

// ══════════════════════════════════════════════
//  CHECK IF ALREADY COMPLETED
// ══════════════════════════════════════════════

function hasCompletedTest() {
  const data = localStorage.getItem('binglish_test_done');
  return data ? JSON.parse(data) : null;
}

// ══════════════════════════════════════════════
//  OPEN / CLOSE MODAL
// ══════════════════════════════════════════════

function openTestModal() {
  // Check if already completed
  const prev = hasCompletedTest();
  if (prev) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'info',
        title: 'Test Completado Anteriormente',
        html: `Ya realizaste el test de nivelación.<br><br>
               <strong style="font-size:1.3em;color:#F5C518;">Tu nivel: ${prev.level} — ${prev.level_name}</strong><br>
               <span style="color:rgba(255,255,255,0.6);">Puntuación: ${prev.score}/60 (${prev.percentage}%)</span><br><br>
               <span style="color:rgba(255,255,255,0.5);">¡Contáctanos para empezar tu curso de inglés! 🎓</span>`,
        confirmButtonColor: '#CC2936',
        confirmButtonText: 'Cerrar',
      });
    } else {
      alert(`Ya completaste el test. Tu nivel: ${prev.level} — ${prev.level_name} (${prev.score}/60)`);
    }
    return;
  }

  testCurrentPage = 0;
  testAnswers = new Array(TOTAL_QUESTIONS).fill(-1);
  buildTestModal();
  document.getElementById('testOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTestModal(force = false) {
  // If not forcing, check if there's progress
  if (!force) {
    const answered = testAnswers.filter(a => a !== -1).length;
    if (answered > 0 && !hasCompletedTest()) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'warning',
          title: '¿Salir del test?',
          text: 'Si cierras el test ahora, perderás todo tu progreso. ¿Estás seguro?',
          showCancelButton: true,
          confirmButtonColor: '#CC2936',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'Sí, salir y perder progreso',
          cancelButtonText: 'Continuar test'
        }).then((result) => {
          if (result.isConfirmed) {
            actuallyCloseTestModal();
          }
        });
        return;
      } else {
        if (!confirm('Si cierras el test ahora, perderás todo tu progreso. ¿Estás seguro?')) {
          return;
        }
      }
    }
  }
  actuallyCloseTestModal();
}

function actuallyCloseTestModal() {
  document.getElementById('testOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handleTestOverlayClick(e) {
  if (e.target === document.getElementById('testOverlay')) closeTestModal();
}

// ══════════════════════════════════════════════
//  BUILD MODAL CONTENT
// ══════════════════════════════════════════════

function buildTestModal() {
  const body = document.getElementById('testModalBody');
  body.innerHTML = '';

  // Reset visibility
  body.style.display = '';
  document.getElementById('testProgressInfo').style.display = '';
  document.getElementById('testPageDots').style.display = '';
  document.getElementById('testProgressTrack').style.display = '';
  document.getElementById('testModalFooter').style.display = '';
  document.getElementById('testResultsPanel').classList.remove('show');
  document.getElementById('testLoading').classList.remove('show');

  for (let p = 0; p < TOTAL_PAGES; p++) {
    const page = TEST_PAGES[p];
    const pageDiv = document.createElement('div');
    pageDiv.className = 'test-questions-page' + (p === 0 ? ' active' : '');
    pageDiv.id = `test-page-${p}`;

    // Section title
    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'test-section-title';
    sectionTitle.textContent = page.title;
    pageDiv.appendChild(sectionTitle);

    // Reading contexts (if this page has reading questions)
    let lastReading = 0;
    for (let i = page.start; i < page.end; i++) {
      const q = TEST_QUESTIONS[i];

      // Insert reading context before the first question of each reading text
      if (q.reading && q.reading !== lastReading) {
        lastReading = q.reading;
        const ctx = document.createElement('div');
        ctx.className = 'test-reading-context';
        ctx.innerHTML = `<strong>Reading Text ${q.reading}</strong>${READING_TEXTS[q.reading]}`;
        pageDiv.appendChild(ctx);
      }

      pageDiv.appendChild(buildTestQuestion(i, q));
    }

    body.appendChild(pageDiv);
  }

  buildTestDots();
  updateTestProgress();
}

function buildTestQuestion(index, q) {
  const block = document.createElement('div');
  block.className = 'test-question-block' + (testAnswers[index] !== -1 ? ' answered' : '');
  block.id = `test-qblock-${index}`;

  const num = document.createElement('div');
  num.className = 'test-question-num';
  num.textContent = `Pregunta ${index + 1}`;

  const text = document.createElement('div');
  text.className = 'test-question-text';
  text.innerHTML = q.q.replace('___', '<em>___</em>');

  block.appendChild(num);
  block.appendChild(text);

  const grid = document.createElement('div');
  grid.className = 'test-options-grid';
  const letters = ['A', 'B', 'C', 'D'];

  q.options.forEach((opt, oi) => {
    const lbl = document.createElement('label');
    lbl.className = 'test-option-label';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `testq${index}`;
    radio.value = oi;
    if (testAnswers[index] === oi) radio.checked = true;

    radio.addEventListener('change', () => {
      testAnswers[index] = oi;
      updateTestQuestion(index);
      updateTestProgress();
    });

    const letter = document.createElement('span');
    letter.className = 'test-option-letter';
    letter.textContent = letters[oi];

    const optText = document.createElement('span');
    optText.className = 'test-option-text';
    optText.textContent = opt;

    lbl.appendChild(radio);
    lbl.appendChild(letter);
    lbl.appendChild(optText);
    grid.appendChild(lbl);
  });

  block.appendChild(grid);
  return block;
}

function updateTestQuestion(index) {
  const block = document.getElementById(`test-qblock-${index}`);
  if (!block) return;
  block.classList.toggle('answered', testAnswers[index] !== -1);
}

// ══════════════════════════════════════════════
//  DOTS (Page indicators)
// ══════════════════════════════════════════════

function buildTestDots() {
  const container = document.getElementById('testPageDots');
  container.innerHTML = '';
  for (let i = 0; i < TOTAL_PAGES; i++) {
    const dot = document.createElement('div');
    dot.className = 'test-dot' + (i === testCurrentPage ? ' active' : '');
    dot.title = TEST_PAGES[i].title;
    dot.id = `test-dot-${i}`;
    dot.addEventListener('click', () => goToTestPage(i));
    container.appendChild(dot);
  }
}

function refreshTestDots() {
  for (let i = 0; i < TOTAL_PAGES; i++) {
    const dot = document.getElementById(`test-dot-${i}`);
    if (!dot) continue;
    dot.className = 'test-dot';
    if (i === testCurrentPage) dot.classList.add('active');
    else if (isTestPageDone(i)) dot.classList.add('done');
  }
}

function isTestPageDone(pageIdx) {
  const page = TEST_PAGES[pageIdx];
  for (let i = page.start; i < page.end; i++) {
    if (testAnswers[i] === -1) return false;
  }
  return true;
}

// ══════════════════════════════════════════════
//  PROGRESS
// ══════════════════════════════════════════════

function updateTestProgress() {
  const answered = testAnswers.filter(a => a !== -1).length;
  const pct = Math.round((answered / TOTAL_QUESTIONS) * 100);

  document.getElementById('testProgressFill').style.width = pct + '%';
  document.getElementById('testProgressLabel').textContent = `${TEST_PAGES[testCurrentPage].title}`;
  document.getElementById('testProgressPct').textContent = `${pct}% completado`;
  document.getElementById('testAnsweredCount').textContent = answered;

  refreshTestDots();

  // Last page → show submit button and CAPTCHA
  const isLast = testCurrentPage === TOTAL_PAGES - 1;
  document.getElementById('testCaptchaContainer').style.display = isLast ? 'flex' : 'none';

  const nextBtn = document.getElementById('testBtnNext');
  nextBtn.className = 'test-btn-nav ' + (isLast ? 'test-btn-submit' : 'test-btn-next');
  nextBtn.innerHTML = isLast
    ? `Enviar Test <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`
    : `Siguiente <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
}

// ══════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════

function goToTestPage(p) {
  document.getElementById(`test-page-${testCurrentPage}`).classList.remove('active');
  testCurrentPage = p;
  document.getElementById(`test-page-${testCurrentPage}`).classList.add('active');
  document.getElementById('testBtnPrev').disabled = testCurrentPage === 0;
  document.getElementById('testModalBody').scrollTop = 0;
  updateTestProgress();
}

function nextTestPage() {
  if (testCurrentPage === TOTAL_PAGES - 1) {
    submitPlacementTest();
  } else {
    goToTestPage(testCurrentPage + 1);
  }
}

function prevTestPage() {
  if (testCurrentPage > 0) goToTestPage(testCurrentPage - 1);
}

// ══════════════════════════════════════════════
//  SUBMIT TEST TO BACKEND
// ══════════════════════════════════════════════

async function submitPlacementTest() {
  const answered = testAnswers.filter(a => a !== -1).length;

  // Must answer at least 1 question
  if (answered === 0) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'warning', title: 'Sin Respuestas', text: 'Por favor, responde al menos una pregunta antes de enviar.' });
    } else {
      alert('Por favor, responde al menos una pregunta antes de enviar.');
    }
    return;
  }

  // Confirm submission
  if (typeof Swal !== 'undefined') {
    const result = await Swal.fire({
      icon: 'question',
      title: '¿Enviar Test?',
      html: `Respondiste <strong>${answered}</strong> de <strong>60</strong> preguntas.<br>Las preguntas sin responder se marcarán como incorrectas.<br><br><strong>Solo puedes realizar este test una vez.</strong>`,
      showCancelButton: true,
      confirmButtonColor: '#27ae60',
      cancelButtonColor: '#CC2936',
      confirmButtonText: 'Sí, Enviar Test',
      cancelButtonText: 'Revisar Respuestas',
    });
    if (!result.isConfirmed) return;
  }

  // Verify captcha before submitting
  const turnstileResponse = document.querySelector('#testCaptchaContainer [name="cf-turnstile-response"]')?.value;
  if (!turnstileResponse) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'warning', title: 'Verificación requerida', text: 'Por favor, completa el Captcha antes de enviar el test.' });
    } else {
      alert('Por favor, completa el Captcha antes de enviar el test.');
    }
    return;
  }

  // Show loading
  document.getElementById('testModalBody').style.display = 'none';
  document.getElementById('testProgressInfo').style.display = 'none';
  document.getElementById('testCaptchaContainer').style.display = 'none';
  document.getElementById('testPageDots').style.display = 'none';
  document.getElementById('testProgressTrack').style.display = 'none';
  document.getElementById('testModalFooter').style.display = 'none';
  document.getElementById('testLoading').classList.add('show');

  try {
    // Send to backend
    const endpoint = (typeof API_BASE !== 'undefined') ? API_BASE : '/apib';
    const res = await fetch(`${endpoint}/placement-test/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: testAnswers, turnstile_token: turnstileResponse }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Server error' }));
      throw new Error(err.detail || `Error ${res.status}`);
    }

    const data = await res.json();

    // Save to localStorage (block repeat)
    localStorage.setItem('binglish_test_done', JSON.stringify({
      completed: true,
      date: new Date().toISOString(),
      score: data.score,
      total: data.total,
      percentage: data.percentage,
      level: data.level,
      level_name: data.level_name,
    }));

    showTestResults(data);
  } catch (error) {
    document.getElementById('testLoading').classList.remove('show');
    document.getElementById('testModalBody').style.display = '';
    document.getElementById('testProgressInfo').style.display = '';
    document.getElementById('testCaptchaContainer').style.display = 'flex';
    document.getElementById('testPageDots').style.display = '';
    document.getElementById('testProgressTrack').style.display = '';
    document.getElementById('testModalFooter').style.display = '';

    // Reset turnstile if it failed
    if (typeof turnstile !== 'undefined') {
      turnstile.reset();
    }

    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo enviar el test. Por favor, inténtalo de nuevo.' });
    } else {
      alert('Error: ' + (error.message || 'No se pudo enviar el test.'));
    }
  }
}

// ══════════════════════════════════════════════
//  SHOW RESULTS
// ══════════════════════════════════════════════

function showTestResults(data) {
  document.getElementById('testLoading').classList.remove('show');

  // Level badge
  const badge = document.getElementById('testLevelBadge');
  badge.textContent = data.level;
  badge.className = `test-level-badge level-${data.level.toLowerCase()}`;

  // Level name
  document.getElementById('testLevelName').textContent = data.level_name;

  // Score
  document.getElementById('testScoreNum').textContent = `${data.score}/${data.total}`;
  document.getElementById('testScoreLabel').textContent = `${data.percentage}% correct answers`;

  // Section breakdown
  const breakdown = document.getElementById('testSectionsBreakdown');
  breakdown.innerHTML = '<h4>Performance by Section</h4>';

  const sectionNames = Object.keys(data.sections);
  sectionNames.forEach(name => {
    const sec = data.sections[name];
    const barClass = sec.percentage >= 70 ? 'bar-b1' : sec.percentage >= 40 ? 'bar-a2' : 'bar-a1';

    const row = document.createElement('div');
    row.className = 'test-section-row';
    row.innerHTML = `
      <span class="test-section-name">${name}</span>
      <div class="test-section-bar">
        <div class="test-section-bar-fill ${barClass}" style="width: 0%"></div>
      </div>
      <span class="test-section-pct">${sec.correct}/${sec.total}</span>
    `;
    breakdown.appendChild(row);

    // Animate bar after a short delay
    setTimeout(() => {
      row.querySelector('.test-section-bar-fill').style.width = sec.percentage + '%';
    }, 300);
  });

  // Anchor badge
  const anchorDiv = document.getElementById('testAnchorBadge');
  if (data.anchor_ready) {
    anchorDiv.style.display = 'block';
  } else {
    anchorDiv.style.display = 'none';
  }

  // Show panel
  document.getElementById('testResultsPanel').classList.add('show');
}

// ══════════════════════════════════════════════
//  KEYBOARD SHORTCUT
// ══════════════════════════════════════════════

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('testOverlay');
    if (overlay && overlay.classList.contains('open')) {
      closeTestModal();
    }
  }
});

// Make openTestModal available globally (called from index.html button)
window.openTestModal = openTestModal;
