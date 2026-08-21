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
  try {
    const themeTitle = (await loadText('text/title.txt')).trim();

    document.getElementById('theme-title').textContent = themeTitle;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: themeTitle,
        artist: 'ラジオトーク'
      });
    }
  } catch {
    document.getElementById('theme-title').textContent = 'テーマを読み込めませんでした';
  }

  document.querySelectorAll('.script-box').forEach(async box => {
    try { box.innerHTML = formatText(await loadText(box.dataset.text)); }
    catch { box.textContent = '原稿を読み込めませんでした'; }
  });

    /* ========================================
     言語切替
     PC：従来のタブ切替
     スマホ：3言語を横スクロール
  ======================================== */

  const buttons = Array.from(
    document.querySelectorAll('.tab-button')
  );

  const panels = Array.from(
    document.querySelectorAll('.tab-panel')
  );

  const contentCard =
    document.querySelector('.content-card');

  const mobileQuery =
    window.matchMedia('(max-width: 640px)');

  let currentLanguage = 'ja';

  let scrollTimer = null;


  /* =========================
     タブの見た目を更新
  ========================= */

  function updateActiveTab(language) {

    buttons.forEach(button => {

      const isActive =
        button.dataset.tab === language;

      button.classList.toggle(
        'active',
        isActive
      );

      button.setAttribute(
        'aria-selected',
        isActive ? 'true' : 'false'
      );

    });

  }


  /* =========================
     言語変更を他機能へ通知
  ========================= */

  function notifyLanguageChange(language) {

    if (currentLanguage === language) {
      return;
    }

    currentLanguage = language;

    document.dispatchEvent(
      new CustomEvent(
        'languageTabChanged',
        {
          detail: {
            language: language
          }
        }
      )
    );

  }


  /* =========================
     PC版
     今まで通り1言語だけ表示
  ========================= */

  function switchDesktopLanguage(language) {

    updateActiveTab(language);

    panels.forEach(panel => {

      const isActive =
        panel.dataset.panel === language;

      panel.hidden = !isActive;

      panel.classList.toggle(
        'active',
        isActive
      );

    });

    notifyLanguageChange(language);

  }


  /* =========================
     スマホ版
     3言語を全部表示
  ========================= */

  function prepareMobilePanels() {

    panels.forEach(panel => {

      panel.hidden = false;

    });

  }


  /* =========================
     タブを押したとき
  ========================= */

  buttons.forEach(button => {

    button.addEventListener(
      'click',
      () => {

        const language =
          button.dataset.tab;

        /*
           スマホ
           → 対応する言語までヌルッと横移動
        */
        if (mobileQuery.matches) {

          prepareMobilePanels();

          const index =
            panels.findIndex(
              panel =>
                panel.dataset.panel === language
            );

          if (
            index === -1 ||
            !contentCard
          ) {
            return;
          }

          const pageWidth =
            contentCard.clientWidth;

          contentCard.scrollTo({
            left: pageWidth * index,
            behavior: 'smooth'
          });

          updateActiveTab(language);

          notifyLanguageChange(language);

          return;
        }


        /*
           PC
        */
        switchDesktopLanguage(language);

      }
    );

  });


  /* =========================
     横スクロールに合わせて
     言語タブを自動切替
  ========================= */

  contentCard?.addEventListener(
    'scroll',
    () => {

      if (!mobileQuery.matches) {
        return;
      }

      clearTimeout(scrollTimer);

      /*
         指で動かしている途中でも
         一番近い言語を判定
      */

      const pageWidth =
        contentCard.clientWidth;

      if (!pageWidth) {
        return;
      }

      let index =
        Math.round(
          contentCard.scrollLeft /
          pageWidth
        );

      index = Math.max(
        0,
        Math.min(
          panels.length - 1,
          index
        )
      );

      const language =
        panels[index]?.dataset.panel;

      if (language) {
        updateActiveTab(language);
      }


      /*
         スクロールが止まったら
         正式に言語変更として通知
      */

      scrollTimer = setTimeout(
        () => {

          const finalWidth =
            contentCard.clientWidth;

          if (!finalWidth) {
            return;
          }

          let finalIndex =
            Math.round(
              contentCard.scrollLeft /
              finalWidth
            );

          finalIndex = Math.max(
            0,
            Math.min(
              panels.length - 1,
              finalIndex
            )
          );

          const finalLanguage =
            panels[
              finalIndex
            ]?.dataset.panel;

          if (!finalLanguage) {
            return;
          }

          updateActiveTab(
            finalLanguage
          );

          notifyLanguageChange(
            finalLanguage
          );

        },
        100
      );

    },
    {
      passive: true
    }
  );


  /* =========================
     PC ⇄ スマホ切替時の処理
  ========================= */

  function applyLanguageLayout() {

    if (mobileQuery.matches) {

      /*
         スマホでは全言語を並べる
      */

      prepareMobilePanels();

      const index =
        Math.max(
          0,
          panels.findIndex(
            panel =>
              panel.dataset.panel ===
              currentLanguage
          )
        );

      requestAnimationFrame(() => {

        if (!contentCard) {
          return;
        }

        contentCard.scrollLeft =
          contentCard.clientWidth *
          index;

      });

    } else {

      /*
         PCに戻ったら
         現在言語だけ表示
      */

      switchDesktopLanguage(
        currentLanguage
      );

    }

  }


  mobileQuery.addEventListener(
    'change',
    applyLanguageLayout
  );

  applyLanguageLayout();


  initPlayButton();

}

function formatTime(seconds) {

  const minutes = Math.floor(seconds / 60);
  const remainSeconds = Math.floor(seconds % 60);

  return `${minutes}:${String(remainSeconds).padStart(2, '0')}`;

}

function initPlayButton() {

  const episodeId = document.body.dataset.episodeId;

  const statusTexts = {
    ja: {
      unplayed: '未再生',
      playing: '再生途中',
      completed: '再生済み',
      play: '再生',
      pause: '一時停止',
      loading: '音声を読み込んでいます…',
      error: '音声を再生できませんでした。通信環境を確認して、もう一度お試しください。'
    },

    vi: {
      unplayed: 'Chưa nghe',
      playing: 'Đang nghe',
      completed: 'Đã nghe',
      play: 'Phát',
      pause: 'Tạm dừng',
      loading: 'Đang tải âm thanh…',
      error: 'Không thể phát âm thanh. Vui lòng kiểm tra kết nối và thử lại.'
    },

    id: {
      unplayed: 'Belum diputar',
      playing: 'Sedang diputar',
      completed: 'Selesai diputar',
      play: 'Putar',
      pause: 'Jeda',
      loading: 'Memuat audio…',
      error: 'Audio tidak dapat diputar. Periksa koneksi lalu coba lagi.'
    }
  };

  const miniPlayer = document.querySelector('.mini-player');
  const miniToggle = document.querySelector('.mini-player-toggle');
  const miniLanguage = document.querySelector('.mini-language');
  const miniTime = document.querySelector('.mini-time');

  document.addEventListener('languageTabChanged', event => {
    const language = event.detail?.language;
    if (!language) return;

    const panel = document.querySelector(`[data-panel="${language}"]`);
    const audio = panel?.querySelector(
      `.audio-source[data-language="${language}"]`
    );
    const player = panel?.querySelector(
      `.custom-player[data-language="${language}"]`
    );
    const playButton = player?.querySelector('.play-button');

    if (!audio || !playButton) return;

    activeAudio = audio;
    activePlayButton = playButton;
    activeTexts = statusTexts[language];

    miniLanguage.textContent =
      language === 'ja'
        ? 'JP 日本語'
        : language === 'vi'
          ? 'VN Tiếng Việt'
          : 'ID Indonesia';

    miniTime.textContent =
      `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;

    const percent = audio.duration
      ? (audio.currentTime / audio.duration) * 100
      : 0;

    miniSeekProgress.style.width = percent + '%';
    miniSeekKnob.style.left = percent + '%';

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
        ? activeTexts.pause
        : activeTexts.play
    );
  });

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

    const audioMessage = document.createElement('p');
    audioMessage.className = 'audio-message';
    audioMessage.setAttribute('aria-live', 'polite');
    audioMessage.hidden = true;

    playStatus.insertAdjacentElement('afterend', audioMessage);

    function showAudioMessage(type, message) {
      audioMessage.dataset.type = type;
      audioMessage.textContent = message;
      audioMessage.hidden = false;
    }

    function hideAudioMessage() {
      audioMessage.hidden = true;
      audioMessage.textContent = '';
      delete audioMessage.dataset.type;
    }

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

    const audioId = audio.getAttribute('src');

    const positionKey = `radio-${episodeId}-${language}-position`;
    const completedKey = `radio-${episodeId}-${language}-completed`;

    const savedCompleted =
      localStorage.getItem(completedKey) === 'true';

    if (savedCompleted) {
      playStatus.textContent = texts.completed;
      playStatus.dataset.status = 'completed';
    }

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
              episode_id: episodeId,
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

          showAudioMessage('error', texts.error);

          playButton.classList.remove('is-playing');
          playButton.setAttribute('aria-label', texts.play);

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

    speedButtons.forEach((button, index) => {

      button.addEventListener('click', () => {

        audio.playbackRate =
          Number(button.dataset.speed);

        speedButtons.forEach(btn => {
          btn.classList.remove('active');
        });

        button.classList.add('active');

        const speedButtonsArea =
          button.closest('.speed-buttons');

        speedButtonsArea.style.setProperty(
          '--speed-position',
          index
        );

      });

    });

    audio.addEventListener('loadstart', () => {
      if (audio.readyState < 1) {
        showAudioMessage('loading', texts.loading);
      }
    });

    audio.addEventListener('waiting', () => {
      showAudioMessage('loading', texts.loading);
    });

    audio.addEventListener('stalled', () => {
      if (!audio.paused) {
        showAudioMessage('loading', texts.loading);
      }
    });

    audio.addEventListener('playing', () => {
      hideAudioMessage();
    });

    audio.addEventListener('canplay', () => {
      hideAudioMessage();
    });

    audio.addEventListener('error', () => {
      showAudioMessage('error', texts.error);

      playButton.classList.remove('is-playing');
      playButton.setAttribute('aria-label', texts.play);

      if (activeAudio === audio) {
        miniPlayButton.classList.remove('is-playing');
        miniPlayButton.setAttribute('aria-label', texts.play);
      }
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

        const progressPercent =
          progress * 100;

        if (progress >= 0.95) {
          localStorage.setItem(
            completedKey,
            'true'
          );

          localStorage.removeItem(positionKey);
        }

        if (
          progressPercent >= 25 &&
          !playbackMilestones[25] &&
          typeof gtag === 'function'
        ) {
          playbackMilestones[25] = true;

          console.log('25%到達', progressPercent);

          gtag('event', 'audio_25', {
            episode_id: episodeId,
            audio_language: language
          });
        }

        if (
          progressPercent >= 50 &&
          !playbackMilestones[50] &&
          typeof gtag === 'function'
        ) {
          playbackMilestones[50] = true;

          gtag('event', 'audio_50', {
            episode_id: episodeId,
            audio_language: language
          });
        }

        if (
          progressPercent >= 75 &&
          !playbackMilestones[75] &&
          typeof gtag === 'function'
        ) {
          playbackMilestones[75] = true;

          gtag('event', 'audio_75', {
            episode_id: episodeId,
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
            episode_id: episodeId,
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

// テーマタイトルの「|」を改行に変換
const themeTitle = document.getElementById("theme-title");

if (themeTitle) {
  const formatThemeTitle = () => {
    const text = themeTitle.textContent;

    if (!text.includes("|")) return;

    themeTitle.innerHTML = text
      .split("|")
      .map(part => part.trim())
      .join("<br>");
  };

  const themeTitleObserver = new MutationObserver(() => {
    formatThemeTitle();
  });

  themeTitleObserver.observe(themeTitle, {
    childList: true,
    characterData: true,
    subtree: true
  });

  formatThemeTitle();
}

document.addEventListener('DOMContentLoaded', init);
