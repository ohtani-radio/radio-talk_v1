const escapeHTML = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function formatText(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    if (line.startsWith('◆')) { closeList(); html += `<h4>${escapeHTML(line.slice(1).trim())}</h4>`; }
    else if (line.startsWith('■')) { closeList(); html += `<h5>${escapeHTML(line.slice(1).trim())}</h5>`; }
    else if (line.startsWith('・')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${escapeHTML(line.slice(1).trim())}</li>`;
    }
    else if (line.startsWith('>')) { closeList(); html += `<blockquote>${escapeHTML(line.slice(1).trim())}</blockquote>`; }
    else { closeList(); html += `<p>${escapeHTML(line)}</p>`; }
  }
  closeList();
  return html;
}

async function loadText(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(path);
  return await res.text();
}

async function init() {
  try { document.getElementById('theme-title').textContent = (await loadText('text/title.txt')).trim(); }
  catch { document.getElementById('theme-title').textContent = 'テーマを読み込めませんでした'; }

  document.querySelectorAll('.script-box').forEach(async box => {
    try { box.innerHTML = formatText(await loadText(box.dataset.text)); }
    catch { box.textContent = '原稿を読み込めませんでした'; }
  });

  const buttons = document.querySelectorAll('.tab-button');
  const panels = document.querySelectorAll('.tab-panel');
  buttons.forEach(btn => btn.addEventListener('click', () => {
    buttons.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
    panels.forEach(p => { p.hidden = true; p.classList.remove('active'); });
    btn.classList.add('active'); btn.setAttribute('aria-selected', 'true');
    const panel = document.querySelector(`[data-panel="${btn.dataset.tab}"]`);
    panel.hidden = false; panel.classList.add('active');
  }));

  initPlayButton();

}

function formatTime(seconds) {

  const minutes = Math.floor(seconds / 60);
  const remainSeconds = Math.floor(seconds % 60);

  return `${minutes}:${String(remainSeconds).padStart(2, '0')}`;

}

function initPlayButton() {

  const statusTexts = {
    ja: {
      unplayed: '未再生',
      playing: '再生途中',
      completed: '再生済み',
      play: '再生',
      pause: '一時停止'
    },

    vi: {
      unplayed: 'Chưa nghe',
      playing: 'Đang nghe',
      completed: 'Đã nghe',
      play: 'Phát',
      pause: 'Tạm dừng'
    },

    id: {
      unplayed: 'Belum diputar',
      playing: 'Sedang diputar',
      completed: 'Selesai diputar',
      play: 'Putar',
      pause: 'Jeda'
    }
  };

  const miniPlayer = document.querySelector('.mini-player');
  const miniToggle = document.querySelector('.mini-player-toggle');
  const miniLanguage = document.querySelector('.mini-language');
  const miniTime = document.querySelector('.mini-time');
  const miniPlayButton = document.querySelector('.mini-play');
  const miniRewindButton = document.querySelector('.mini-rewind');
  const miniForwardButton = document.querySelector('.mini-forward');
  const miniSeekBar = document.querySelector('.mini-seek-bar');
  const miniSeekProgress = document.querySelector('.mini-seek-progress');
  const miniSeekKnob = document.querySelector('.mini-seek-knob');

  let activeAudio = null;
  let activePlayButton = null;
  let activeTexts = null;

  let hasSentAudioStart = false;

  let playbackMilestones = {
    25: false,
    50: false,
    75: false,
    95: false
  };

  const players = document.querySelectorAll('.custom-player');

  function updateMiniPlayerVisibility() {

    if (!activePlayButton) {
      miniPlayer.hidden = true;
      return;
    }

    const playerElement =
      activePlayButton.closest('.custom-player');

    if (!playerElement) {
      miniPlayer.hidden = true;
      return;
    }

    const rect = playerElement.getBoundingClientRect();

    const isVisible =
      rect.bottom > 0 &&
      rect.top < window.innerHeight;

    miniPlayer.hidden = isVisible;

  }

  players.forEach(player => {

    const language = player.dataset.language;
    const texts = statusTexts[language];

    const panel = player.closest('.tab-panel');
    const audio = panel?.querySelector(
      `.audio-source[data-language="${language}"]`
    );

    const playButton = player.querySelector('.play-button');
    const currentTime = player.querySelector('.current-time');
    const durationTime = player.querySelector('.duration-time');
    const playStatus = player.querySelector('.play-status');

    const seekBar = player.querySelector('.seek-bar');
    const seekProgress = player.querySelector('.seek-progress');
    const seekKnob = player.querySelector('.seek-knob');

    const rewindButton = player.querySelector('.rewind-button');
    const forwardButton = player.querySelector('.forward-button');

    const speedButtons =
      player.querySelectorAll('.speed-buttons button');

    if (
      !language ||
      !texts ||
      !audio ||
      !playButton ||
      !seekBar
    ) {
      return;
    }

    const positionKey = `radio-${language}-position`;
    const completedKey = `radio-${language}-completed`;

    function updatePlayStatus() {

      const isCompleted =
        localStorage.getItem(completedKey) === 'true';

      const progress = audio.duration
        ? audio.currentTime / audio.duration
        : 0;

      if (isCompleted || progress >= 0.95) {

        playStatus.textContent = texts.completed;
        playStatus.dataset.status = 'completed';

      } else if (audio.currentTime > 0) {

        playStatus.textContent = texts.playing;
        playStatus.dataset.status = 'playing';

      } else {

        playStatus.textContent = texts.unplayed;
        playStatus.dataset.status = 'unplayed';

      }
    }

    function updateDuration() {

      if (Number.isFinite(audio.duration)) {
        durationTime.textContent =
          formatTime(audio.duration);
      }
    }

    function stopOtherPlayers() {

      document
        .querySelectorAll('.audio-source')
        .forEach(otherAudio => {

          if (otherAudio !== audio) {
            otherAudio.pause();
          }

        });

      document
        .querySelectorAll('.play-button')
        .forEach(otherButton => {

          if (otherButton !== playButton) {
            otherButton.classList.remove('is-playing');
          }

        });
    }

    playButton.addEventListener('click', async () => {

      if (audio.paused) {

        stopOtherPlayers();

        if (
          audio.ended ||
          audio.currentTime >= audio.duration
        ) {
          audio.currentTime = 0;
        }

        try {

          await audio.play();

          activeAudio = audio;
          activePlayButton = playButton;
          activeTexts = texts;

          if (
            !hasSentAudioStart &&
            typeof gtag === 'function'
          ) {
            console.log('audio_start送信', language);

            gtag('event', 'audio_start', {
              audio_language: language,
              send_to: 'G-PGVD9L27LG'
            });

            hasSentAudioStart = true;

            playbackMilestones = {
              25: false,
              50: false,
              75: false,
              95: false
            };

          }

          miniPlayer.hidden = false;

          updateMiniPlayerVisibility();

          miniLanguage.textContent =
            language === 'ja'
              ? 'JP 日本語'
              : language === 'vi'
                ? 'VN Tiếng Việt'
                : 'ID Indonesia';

          miniPlayButton.classList.add('is-playing');
          miniPlayButton.setAttribute('aria-label', texts.pause);

          playButton.classList.add('is-playing');
          playButton.setAttribute(
            'aria-label',
            texts.pause
          );

        } catch (error) {

          console.error('音声を再生できませんでした', error);

        }

      } else {

        audio.pause();

        playButton.classList.remove('is-playing');
        playButton.setAttribute(
          'aria-label',
          texts.play
        );

      }
    });

    rewindButton.addEventListener('click', () => {

      audio.currentTime = Math.max(
        0,
        audio.currentTime - 10
      );

    });

    forwardButton.addEventListener('click', () => {

      if (!audio.duration) return;

      audio.currentTime = Math.min(
        audio.duration,
        audio.currentTime + 10
      );

    });

    speedButtons.forEach(button => {

      button.addEventListener('click', () => {

        audio.playbackRate =
          Number(button.dataset.speed);

        speedButtons.forEach(btn => {
          btn.classList.remove('active');
        });

        button.classList.add('active');

      });

    });

    audio.addEventListener('ended', () => {

      playButton.classList.remove('is-playing');

      playButton.setAttribute(
        'aria-label',
        texts.play
      );

      updatePlayStatus();
      function syncMiniPlayState() {
        if (activeAudio !== audio) return;

        const isPlaying =
          !audio.paused &&
          !audio.ended;

        miniPlayButton.classList.toggle(
          'is-playing',
          isPlaying
        );

        miniPlayButton.setAttribute(
          'aria-label',
          isPlaying
            ? texts.pause
            : texts.play
        );
      }

      audio.addEventListener('play', syncMiniPlayState);
      audio.addEventListener('pause', syncMiniPlayState);
      audio.addEventListener('ended', syncMiniPlayState);

    });

    audio.addEventListener('timeupdate', () => {

      currentTime.textContent =
        formatTime(audio.currentTime);

      if (activeAudio === audio) {

        miniTime.textContent =
          `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;

        const miniPercent = audio.duration
          ? (audio.currentTime / audio.duration) * 100
          : 0;

        miniSeekProgress.style.width = miniPercent + '%';
        miniSeekKnob.style.left = miniPercent + '%';
      }

      const percent = audio.duration
        ? (audio.currentTime / audio.duration) * 100
        : 0;

      seekProgress.style.width = percent + '%';
      seekKnob.style.left = percent + '%';

      localStorage.setItem(
        positionKey,
        audio.currentTime
      );

      if (audio.duration) {

        const progress =
          audio.currentTime / audio.duration;

        if (progress >= 0.95) {
          localStorage.setItem(
            completedKey,
            'true'
          );

          localStorage.removeItem(positionKey);
        }
      }

      if (audio.duration) {

        const percent =
          (audio.currentTime / audio.duration) * 100;

        if (
          progressPercent >= 25 &&
          !playbackMilestones[25] &&
          typeof gtag === 'function'
        ) {
          playbackMilestones[25] = true;

          console.log('25%到達', progressPercent);

          gtag('event', 'audio_25', {
            audio_language: language
          });
        }

        if (percent >= 50 && !playbackMilestones[50]) {
          playbackMilestones[50] = true;

          gtag('event', 'audio_50', {
            audio_language: language
          });
        }

        if (percent >= 75 && !playbackMilestones[75]) {
          playbackMilestones[75] = true;

          gtag('event', 'audio_75', {
            audio_language: language
          });
        }

        if (
          progressPercent >= 95 &&
          !playbackMilestones[95] &&
          typeof gtag === 'function'
        ) {
          playbackMilestones[95] = true;

          console.log('95%到達', progressPercent);

          gtag('event', 'audio_complete', {
            audio_language: language
          });
        }

      }

      updatePlayStatus();

    });

    audio.addEventListener('loadedmetadata', () => {

      updateDuration();

      const savedPosition = Number(
        localStorage.getItem(positionKey)
      );

      const savedProgress = audio.duration
        ? savedPosition / audio.duration
        : 0;

      const isCompleted =
        localStorage.getItem(completedKey) === 'true';

      if (isCompleted) {

        audio.currentTime = 0;

      } else if (
        savedPosition > 0 &&
        savedPosition < audio.duration
      ) {

        audio.currentTime = savedPosition;

      }

      updatePlayStatus();

    });

    audio.addEventListener(
      'durationchange',
      updateDuration
    );

    if (audio.readyState >= 1) {
      updateDuration();
    }

    function moveSeekPosition(clientX) {

      if (!audio.duration) return;

      const rect =
        seekBar.getBoundingClientRect();

      let percent =
        (clientX - rect.left) / rect.width;

      percent = Math.max(
        0,
        Math.min(1, percent)
      );

      audio.currentTime =
        percent * audio.duration;

      seekProgress.style.width =
        (percent * 100) + '%';

      seekKnob.style.left =
        (percent * 100) + '%';
    }

    let isDragging = false;

    seekBar.addEventListener(
      'pointerdown',
      event => {

        isDragging = true;

        seekBar.classList.add('dragging');

        seekBar.setPointerCapture(
          event.pointerId
        );

        moveSeekPosition(event.clientX);
      }
    );

    seekBar.addEventListener(
      'pointermove',
      event => {

        if (!isDragging) return;

        moveSeekPosition(event.clientX);

      }
    );

    seekBar.addEventListener(
      'pointerup',
      event => {

        isDragging = false;

        seekBar.classList.remove('dragging');

        if (
          seekBar.hasPointerCapture(
            event.pointerId
          )
        ) {
          seekBar.releasePointerCapture(
            event.pointerId
          );
        }
      }
    );

    seekBar.addEventListener(
      'pointercancel',
      () => {

        isDragging = false;

        seekBar.classList.remove('dragging');

      }
    );

  });

  miniPlayButton.addEventListener('click', async () => {

    if (!activeAudio) return;

    if (activeAudio.paused) {

      await activeAudio.play();

      miniPlayButton.classList.add('is-playing');
      miniPlayButton.setAttribute(
        'aria-label',
        activeTexts?.pause || '一時停止'
      );

      if (activePlayButton) {
        activePlayButton.classList.add('is-playing');
      }

    } else {

      activeAudio.pause();

      miniPlayButton.classList.remove('is-playing');
      miniPlayButton.setAttribute(
        'aria-label',
        activeTexts?.play || '再生'
      );

      if (activePlayButton) {
        activePlayButton.classList.remove('is-playing');
      }

    }

  });

  miniRewindButton.addEventListener('click', () => {
    if (!activeAudio) return;

    activeAudio.currentTime = Math.max(
      0,
      activeAudio.currentTime - 10
    );
  });

  miniForwardButton.addEventListener('click', () => {
    if (!activeAudio || !activeAudio.duration) return;

    activeAudio.currentTime = Math.min(
      activeAudio.duration,
      activeAudio.currentTime + 10
    );
  });

  window.addEventListener(
    'scroll',
    updateMiniPlayerVisibility
  );

  window.addEventListener(
    'resize',
    updateMiniPlayerVisibility
  );

  function moveMiniSeekPosition(clientX) {

    if (!activeAudio || !activeAudio.duration) return;

    const rect = miniSeekBar.getBoundingClientRect();

    let percent =
      (clientX - rect.left) / rect.width;

    percent = Math.max(
      0,
      Math.min(1, percent)
    );

    activeAudio.currentTime =
      percent * activeAudio.duration;

    miniSeekProgress.style.width =
      (percent * 100) + '%';

    miniSeekKnob.style.left =
      (percent * 100) + '%';
  }

  let isMiniDragging = false;

  miniSeekBar.addEventListener('pointerdown', event => {

    isMiniDragging = true;

    miniSeekBar.setPointerCapture(
      event.pointerId
    );

    moveMiniSeekPosition(event.clientX);
  });

  miniSeekBar.addEventListener('pointermove', event => {

    if (!isMiniDragging) return;

    moveMiniSeekPosition(event.clientX);
  });

  miniSeekBar.addEventListener('pointerup', event => {

    isMiniDragging = false;

    if (
      miniSeekBar.hasPointerCapture(
        event.pointerId
      )
    ) {
      miniSeekBar.releasePointerCapture(
        event.pointerId
      );
    }
  });

  miniSeekBar.addEventListener('pointercancel', () => {

    isMiniDragging = false;

  });
  miniToggle?.addEventListener('click', () => {
    const isOpen = miniPlayer.classList.toggle('open');

    miniToggle.setAttribute('aria-expanded', String(isOpen));
    miniToggle.setAttribute(
      'aria-label',
      isOpen
        ? 'ミニプレーヤーを閉じる'
        : 'ミニプレーヤーを開く'
    );
  });

}

document.addEventListener('DOMContentLoaded', init);
