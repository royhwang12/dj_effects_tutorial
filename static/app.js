(function () {
  let audioContext = null;
  let activeTimeouts = [];

  function track(eventName, payload) {
    $.ajax({
      url: "/api/track",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ event: eventName, payload: payload || {} }),
    });
  }

  function getAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
  }

  function stopScheduledSounds() {
    activeTimeouts.forEach(function (timeoutId) {
      clearTimeout(timeoutId);
    });
    activeTimeouts = [];
  }

  function createTone(context, when, duration, frequency, volume) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    return { osc: osc, gain: gain };
  }

  function playFilterSample() {
    const context = getAudioContext();
    const start = context.currentTime + 0.03;
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    master.gain.value = 0.6;
    filter.type = "highpass";
    filter.frequency.setValueAtTime(120, start);
    filter.frequency.exponentialRampToValueAtTime(2000, start + 2.2);
    filter.Q.value = 0.8;

    const notes = [110, 146.8, 164.8, 220, 246.9, 329.6];
    notes.forEach(function (freq, index) {
      const noteStart = start + index * 0.33;
      const tone = createTone(context, noteStart, 0.26, freq, 0.22);
      tone.gain.connect(filter);
      tone.osc.start(noteStart);
      tone.osc.stop(noteStart + 0.3);
    });

    filter.connect(master);
    master.connect(context.destination);
  }

  function playEchoSample() {
    const context = getAudioContext();
    const start = context.currentTime + 0.03;
    const master = context.createGain();
    master.gain.value = 0.55;
    master.connect(context.destination);

    const tone = createTone(context, start, 0.18, 440, 0.38);
    tone.gain.connect(master);
    tone.osc.start(start);
    tone.osc.stop(start + 0.2);

    const delays = [
      { time: 0.25, gain: 0.22 },
      { time: 0.5, gain: 0.14 },
      { time: 0.75, gain: 0.09 },
      { time: 1.0, gain: 0.06 },
    ];

    delays.forEach(function (item) {
      const echo = createTone(context, start + item.time, 0.14, 440, item.gain);
      echo.gain.connect(master);
      echo.osc.start(start + item.time);
      echo.osc.stop(start + item.time + 0.16);
    });
  }

  function playReverbSample() {
    const context = getAudioContext();
    const start = context.currentTime + 0.03;
    const master = context.createGain();
    master.gain.value = 0.55;
    master.connect(context.destination);

    const tone = createTone(context, start, 0.18, 293.7, 0.33);
    tone.gain.connect(master);
    tone.osc.start(start);
    tone.osc.stop(start + 0.2);

    let delay = 0.06;
    let tailVolume = 0.17;
    while (delay <= 1.35) {
      const tail = createTone(context, start + delay, 0.24, 293.7, tailVolume);
      tail.gain.connect(master);
      tail.osc.start(start + delay);
      tail.osc.stop(start + delay + 0.27);
      delay += 0.11;
      tailVolume *= 0.86;
    }
  }

  function playEffectSample(effect) {
    stopScheduledSounds();
    if (effect === "filter") {
      playFilterSample();
      return;
    }
    if (effect === "echo") {
      playEchoSample();
      return;
    }
    if (effect === "reverb") {
      playReverbSample();
    }
  }

  $(function () {
    if (window.pageMeta && window.pageMeta.route) {
      track("client_page_ready", window.pageMeta);
    }

    $(document).on("click", ".lesson-action", function () {
      const label = $(this).data("label") || "lesson_action";
      track("lesson_action_click", { label: label, route: window.pageMeta?.route || "unknown" });
    });

    $(document).on("submit", ".quiz-form", function () {
      const quizId = $(this).data("quiz-id");
      track("quiz_submit_click", { quiz_id: quizId });
    });

    // live slider value display
    $(document).on('input', '#quiz-slider', function () {
      $('#slider-value').text(this.value);
    });

    function updateRadioStyles(input) {
      const name = input.name;
      const $group = $('input[type="radio"][name="' + name + '"]');
      $group.each(function () {
        $(this).closest('.toggle-pill, .quiz-choice').removeClass('selected');
      });
      $(input).closest('.toggle-pill, .quiz-choice').addClass('selected');
    }

    $(document).on("change", 'input[type="radio"]', function () {
      updateRadioStyles(this);
    });

    $('input[type="radio"]:checked').each(function () {
      updateRadioStyles(this);
    });

    $(document).on("click", ".start-btn", function () {
      $.post("/api/start").done(function (resp) {
        if (resp && resp.next) {
          window.location.href = resp.next;
        }
      });
    });

    $(document).on("click", ".sample-play-btn", async function () {
      const effect = $(this).data("effect");
      const label = $(this).data("label") || "play_effect_sample";
      track("effect_sample_play", { effect: effect, route: window.pageMeta?.route || "unknown" });

      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch (err) {
          return;
        }
      }

      const $btn = $(this);
      $btn.text("Playing...");
      playEffectSample(effect);
      const resetId = setTimeout(function () {
        $btn.text(label);
      }, 1400);
      activeTimeouts.push(resetId);
    });
  });
})();
