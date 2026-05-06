(function () {
  let audioContext = null;
  const deckStates = new WeakMap();
  let sequencerTimer = null;
  let sequencerStep = 0;

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

  function playKick(context, destination, when) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.15);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.95, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(when);
    osc.stop(when + 0.24);
  }

  function playHat(context, destination, when, level) {
    const buffer = context.createBuffer(1, context.sampleRate * 0.06, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = context.createBufferSource();
    src.buffer = buffer;

    const hp = context.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5200;

    const gain = context.createGain();
    gain.gain.setValueAtTime(level || 0.08, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(destination);
    src.start(when);
    src.stop(when + 0.06);
  }

  function playBass(context, destination, when, frequency) {
    const osc = context.createOscillator();
    const sub = context.createOscillator();
    const gain = context.createGain();

    osc.type = "sawtooth";
    sub.type = "sine";
    osc.frequency.setValueAtTime(frequency, when);
    sub.frequency.setValueAtTime(frequency / 2, when);

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.19, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);

    osc.connect(gain);
    sub.connect(gain);
    gain.connect(destination);

    osc.start(when);
    sub.start(when);
    osc.stop(when + 0.3);
    sub.stop(when + 0.3);
  }

  function playChord(context, destination, when) {
    const notes = [261.63, 329.63, 392.0];
    const chordGain = context.createGain();
    chordGain.gain.setValueAtTime(0.0001, when);
    chordGain.gain.exponentialRampToValueAtTime(0.11, when + 0.02);
    chordGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.36);

    notes.forEach(function (freq) {
      const osc = context.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, when);
      osc.connect(chordGain);
      osc.start(when);
      osc.stop(when + 0.38);
    });

    chordGain.connect(destination);
  }

  function playPadNote(frequency, duration, volume, type) {
    const context = getAudioContext();
    const start = context.currentTime + 0.01;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(Number(frequency), start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume || 0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + (duration || 0.2));
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + (duration || 0.2) + 0.02);
  }

  function cutoffFromKnob(value) {
    const min = 220;
    const max = 15500;
    const amount = Number(value) / 100;
    return Math.round(min * Math.pow(max / min, amount));
  }

  function updateKnobVisual($deck, value) {
    const deg = -140 + (Number(value) / 100) * 280;
    $deck.find(".knob-face").css("--knob-angle", deg + "deg");
    $deck.find(".filter-value").text(Math.round(Number(value)) + "%");
  }

  function createImpulseResponse(context, seconds, decay) {
    const length = Math.floor(context.sampleRate * seconds);
    const impulse = context.createBuffer(2, length, context.sampleRate);
    for (let c = 0; c < 2; c += 1) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < length; i += 1) {
        const n = length - i;
        data[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
      }
    }
    return impulse;
  }

  function runDeckStep(state) {
    const context = state.context;
    const stepDur = 60 / state.bpm / 4;
    const when = context.currentTime + 0.02;
    const step = state.step % 16;

    if (step % 4 === 0) playKick(context, state.inputNode, when);
    if (step % 2 === 1) playHat(context, state.inputNode, when, 0.065);
    if (step === 4 || step === 12) playHat(context, state.inputNode, when, 0.11);

    if ([0, 3, 6, 8, 11, 14].indexOf(step) >= 0) {
      const seq = [55, 55, 65.41, 73.42, 82.41, 73.42];
      const freq = seq[(step / 3) % seq.length | 0] || 55;
      playBass(context, state.inputNode, when, freq);
    }

    if (step === 4 || step === 12) playChord(context, state.inputNode, when);

    state.step += 1;
    const progress = (state.step % 32) / 32;
    state.$deck.find(".wave-playhead").css("left", (progress * 100).toFixed(2) + "%");
    state.nextAt = when + stepDur;
  }

  function startDeck($deck) {
    const context = getAudioContext();
    const effectType = $deck.data("effect-type") || "filter";
    const sourceType = $deck.find(".audio-source-select").val() || "house";
    const inputNode = context.createGain();
    const filterNode = context.createBiquadFilter();
    const dryGain = context.createGain();
    const wetGain = context.createGain();
    const gainNode = context.createGain();

    const knobValue = Number($deck.find(".effect-primary-knob").val());
    filterNode.type = effectType === "filter" ? "highpass" : "lowpass";
    filterNode.frequency.value = effectType === "filter" ? cutoffFromKnob(knobValue) : 12000;
    filterNode.Q.value = effectType === "filter" ? (0.8 + (knobValue / 100) * 10) : 0.9;
    gainNode.gain.value = 0.72;

    inputNode.connect(filterNode);
    filterNode.connect(dryGain);
    dryGain.connect(gainNode);

    if (effectType === "echo") {
      const delay = context.createDelay(1.2);
      const feedback = context.createGain();
      delay.delayTime.value = 0.28;
      feedback.gain.value = 0.35;
      filterNode.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wetGain);
      wetGain.gain.value = 0.2;
      wetGain.connect(gainNode);
    } else if (effectType === "reverb") {
      const convolver = context.createConvolver();
      convolver.buffer = createImpulseResponse(context, 3.2, 2.9);
      filterNode.connect(convolver);
      convolver.connect(wetGain);
      wetGain.gain.value = 0.35;
      wetGain.connect(gainNode);
    } else if (effectType === "phaser") {
      const stage1 = context.createBiquadFilter();
      const stage2 = context.createBiquadFilter();
      const stage3 = context.createBiquadFilter();
      const phaserFeedback = context.createGain();
      const lfoOsc = context.createOscillator();
      const lfoGain = context.createGain();
      const knobAmount = knobValue / 100;

      stage1.type = "allpass";
      stage2.type = "allpass";
      stage3.type = "allpass";
      stage1.frequency.value = 420;
      stage2.frequency.value = 980;
      stage3.frequency.value = 2100;
      stage1.Q.value = 2.2 + knobAmount * 14.0;
      stage2.Q.value = 2.2 + knobAmount * 14.0;
      stage3.Q.value = 2.2 + knobAmount * 14.0;
      lfoOsc.type = "triangle";
      lfoOsc.frequency.value = 0.7 + knobAmount * 3.6;
      lfoGain.gain.value = 1500 + knobAmount * 7000;
      phaserFeedback.gain.value = 0.35 + knobAmount * 0.5;

      lfoOsc.connect(lfoGain);
      lfoGain.connect(stage1.frequency);
      lfoGain.connect(stage2.frequency);
      lfoGain.connect(stage3.frequency);

      filterNode.connect(stage1);
      stage1.connect(stage2);
      stage2.connect(stage3);
      stage3.connect(phaserFeedback);
      phaserFeedback.connect(stage1);
      stage3.connect(wetGain);
      wetGain.gain.value = 0.5 + knobAmount * 1.2;
      wetGain.connect(gainNode);
      lfoOsc.start();

      wetGain._lfoOsc = lfoOsc;
      wetGain._lfoGain = lfoGain;
      wetGain._phaserStages = [stage1, stage2, stage3];
      wetGain._phaserFeedback = phaserFeedback;
    } else {
      wetGain.gain.value = 0;
    }

    gainNode.connect(context.destination);

    const state = {
      context: context,
      effectType: effectType,
      sourceType: sourceType,
      effectEnabled: true,
      inputNode: inputNode,
      filterNode: filterNode,
      dryGain: dryGain,
      wetGain: wetGain,
      gainNode: gainNode,
      bpm: 124,
      step: 0,
      intervalId: null,
      $deck: $deck,
      nextAt: context.currentTime,
      audioEl: null,
      mediaSource: null,
    };

    if (sourceType === "custom") {
      const file = $deck.find(".custom-audio-input").get(0)?.files?.[0];
      if (!file) {
        return null;
      }
      const audioEl = new Audio(URL.createObjectURL(file));
      audioEl.loop = true;
      const mediaSource = context.createMediaElementSource(audioEl);
      mediaSource.connect(inputNode);
      state.audioEl = audioEl;
      state.mediaSource = mediaSource;
      state.intervalId = setInterval(function () {
        const duration = audioEl.duration || 0;
        const progress = duration > 0 ? (audioEl.currentTime / duration) : 0;
        state.$deck.find(".wave-playhead").css("left", (Math.max(0, Math.min(1, progress)) * 100).toFixed(2) + "%");
      }, 80);
      audioEl.play();
    } else {
      state.intervalId = setInterval(function () {
        runDeckStep(state);
      }, 120);
    }

    deckStates.set($deck.get(0), state);
    return state;
  }

  function stopDeck($deck) {
    const state = deckStates.get($deck.get(0));
    if (!state) return;
    clearInterval(state.intervalId);
    state.gainNode.gain.setTargetAtTime(0.0001, state.context.currentTime, 0.08);
    if (state.audioEl) {
      try {
        state.audioEl.pause();
        state.audioEl.src = "";
      } catch (err) {
        // no-op
      }
    }
    setTimeout(function () {
      try {
        if (state.mediaSource) state.mediaSource.disconnect();
        if (state.wetGain._lfoOsc) state.wetGain._lfoOsc.stop();
        if (state.wetGain._lfoOsc) state.wetGain._lfoOsc.disconnect();
        if (state.wetGain._lfoGain) state.wetGain._lfoGain.disconnect();
        if (state.wetGain._phaserStages) state.wetGain._phaserStages.forEach(function (s) { s.disconnect(); });
        if (state.wetGain._phaserFeedback) state.wetGain._phaserFeedback.disconnect();
        state.inputNode.disconnect();
        state.filterNode.disconnect();
        state.dryGain.disconnect();
        state.wetGain.disconnect();
        state.gainNode.disconnect();
      } catch (err) {
        return;
      }
    }, 160);
    deckStates.delete($deck.get(0));
  }

  function setDeckPlayingUI($deck, isOn) {
    const $btn = $deck.find(".transport-toggle");
    const sourceType = $deck.find(".audio-source-select").val() || "house";
    const onLabel = $btn.data("label-on") || "Stop";
    const offLabel = sourceType === "custom" ? "Play Custom MP3" : ($btn.data("label-off") || "Play");
    $btn.text(isOn ? onLabel : offLabel);
    $deck.find(".deck-status-text").text(
      isOn
        ? (sourceType === "custom" ? "Deck running - custom track loaded" : "Deck running - house loop loaded")
        : "Deck stopped"
    );
    $deck.find(".deck-status-light").toggleClass("live", !!isOn);
    $deck.find(".deck-waveform").toggleClass("running", !!isOn);
    if (!isOn) {
      $deck.find(".wave-playhead").css("left", "0%");
    }
  }

  function clearSequencerPulse() {
    $(".seq-step").removeClass("playing");
  }

  function runSequencerTick() {
    const $steps = $(".seq-step");
    if (!$steps.length) return;
    const current = sequencerStep % $steps.length;
    clearSequencerPulse();
    const $current = $steps.eq(current);
    $current.addClass("playing");
    if ($current.hasClass("active")) {
      playPadNote(220 + current * 26, 0.11, 0.18, "square");
    }
    sequencerStep += 1;
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

    function updateRadioStyles(input) {
      const name = input.name;
      const $group = $('input[type="radio"][name="' + name + '"]');
      $group.each(function () {
        $(this).closest(".toggle-pill, .quiz-choice").removeClass("selected");
      });
      $(input).closest(".toggle-pill, .quiz-choice").addClass("selected");
    }

    $(document).on("change", 'input[type="radio"]', function () {
      updateRadioStyles(this);
    });

    $('input[type="radio"]:checked').each(function () {
      updateRadioStyles(this);
    });

    $(".dj-rig").each(function () {
      updateKnobVisual($(this), $(this).find(".effect-primary-knob").val());
    });

    $(document).on("click", ".start-btn", function () {
      $.post("/api/start").done(function (resp) {
        if (resp && resp.next) {
          window.location.href = resp.next;
        }
      });
    });

    $(document).on("click", ".transport-toggle", async function () {
      const $deck = $(this).closest(".dj-rig");
      const running = !!deckStates.get($deck.get(0));
      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch (err) {
          return;
        }
      }

      if (running) {
        stopDeck($deck);
        setDeckPlayingUI($deck, false);
        track("deck_stop", { route: window.pageMeta?.route || "unknown" });
        return;
      }

      const started = startDeck($deck);
      if (!started) {
        $deck.find(".deck-status-text").text("Select a custom MP3 first");
        return;
      }
      setDeckPlayingUI($deck, true);
      track("deck_start", { route: window.pageMeta?.route || "unknown" });
    });

    $(document).on("change", ".audio-source-select", function () {
      const $deck = $(this).closest(".dj-rig");
      const running = !!deckStates.get($deck.get(0));
      if (running) {
        stopDeck($deck);
        setDeckPlayingUI($deck, false);
      } else {
        setDeckPlayingUI($deck, false);
      }
      track("deck_source_change", {
        source: $(this).val(),
        route: window.pageMeta?.route || "unknown",
      });
    });

    $(document).on("change", ".custom-audio-input", function () {
      const $deck = $(this).closest(".dj-rig");
      const file = this.files && this.files[0] ? this.files[0].name : null;
      if (file) {
        $deck.find(".audio-source-select").val("custom").trigger("change");
        $deck.find(".deck-status-text").text("Custom file ready: " + file);
      }
      track("deck_custom_file", {
        has_file: !!file,
        route: window.pageMeta?.route || "unknown",
      });
    });

    $(document).on("click", ".effect-active-btn", function () {
      const $btn = $(this);
      const $deck = $btn.closest(".dj-rig");
      const state = deckStates.get($deck.get(0));
      const enable = !$btn.hasClass("is-on");
      $btn.toggleClass("is-on", enable).text(enable ? "Effect Active" : "Effect Bypass");

      if (state) {
        state.effectEnabled = enable;
        const value = Number($deck.find(".effect-primary-knob").val());
        if (state.effectType === "filter") {
          if (enable) {
            state.filterNode.frequency.setTargetAtTime(cutoffFromKnob(value), state.context.currentTime, 0.04);
            state.filterNode.Q.setTargetAtTime(0.8 + (value / 100) * 10, state.context.currentTime, 0.05);
          } else {
            state.filterNode.frequency.setTargetAtTime(12000, state.context.currentTime, 0.04);
            state.filterNode.Q.setTargetAtTime(0.8, state.context.currentTime, 0.05);
          }
        } else if (!enable) {
          state.wetGain.gain.setTargetAtTime(0, state.context.currentTime, 0.05);
        } else {
          $deck.find(".effect-primary-knob").trigger("input");
        }
      }

      track("deck_effect_toggle", { enabled: enable, route: window.pageMeta?.route || "unknown" });
    });

    $(document).on("input", ".effect-primary-knob", function () {
      const $deck = $(this).closest(".dj-rig");
      const value = Number($(this).val());
      updateKnobVisual($deck, value);
      const state = deckStates.get($deck.get(0));
      if (state) {
        if (state.effectType === "filter") {
          if (!state.effectEnabled) return;
          state.filterNode.frequency.setTargetAtTime(cutoffFromKnob(value), state.context.currentTime, 0.03);
          state.filterNode.Q.setTargetAtTime(0.8 + (value / 100) * 10, state.context.currentTime, 0.05);
        } else if (state.effectType === "echo") {
          if (!state.effectEnabled) return;
          state.wetGain.gain.setTargetAtTime(0.05 + (value / 100) * 0.5, state.context.currentTime, 0.05);
        } else if (state.effectType === "reverb") {
          if (!state.effectEnabled) return;
          state.wetGain.gain.setTargetAtTime(0.1 + (value / 100) * 1.05, state.context.currentTime, 0.05);
        } else if (state.effectType === "phaser") {
          if (!state.effectEnabled) return;
          const amount = value / 100;
          state.wetGain.gain.setTargetAtTime(0.5 + amount * 1.2, state.context.currentTime, 0.05);
          if (state.wetGain._lfoOsc) state.wetGain._lfoOsc.frequency.setTargetAtTime(0.7 + amount * 3.6, state.context.currentTime, 0.05);
          if (state.wetGain._lfoGain) state.wetGain._lfoGain.gain.setTargetAtTime(1500 + amount * 7000, state.context.currentTime, 0.05);
          if (state.wetGain._phaserFeedback) state.wetGain._phaserFeedback.gain.setTargetAtTime(0.35 + amount * 0.5, state.context.currentTime, 0.05);
          if (state.wetGain._phaserStages) {
            state.wetGain._phaserStages.forEach(function (stage) {
              stage.Q.setTargetAtTime(2.2 + amount * 14.0, state.context.currentTime, 0.05);
            });
          }
        }
      }
    });

    $(document).on("change", ".effect-primary-knob", function () {
      track("deck_filter_knob", {
        value: Number($(this).val()),
        route: window.pageMeta?.route || "unknown",
      });
    });

    $(document).on("input", ".confidence-slider", function () {
      const value = Number($(this).val());
      $(".confidence-value").text(value + "%");
    });

    $(document).on("change", ".confidence-slider", function () {
      track("quiz_confidence_set", {
        quiz_id: window.pageMeta?.quizId || null,
        confidence: Number($(this).val()),
      });
    });

    $(document).on("keydown", function (event) {
      const key = event.key;
      if (!window.pageMeta || !window.pageMeta.quizId) return;
      if (key < "1" || key > "4") return;
      const idx = Number(key) - 1;
      const $singleChoices = $('.quiz-form input[type="radio"][name="choice"]');
      if ($singleChoices.length && idx < $singleChoices.length) {
        $singleChoices.eq(idx).prop("checked", true).trigger("change");
      }
    });

    $(document).on("click", ".music-pad", async function () {
      const frequency = Number($(this).data("note"));
      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch (err) {
          return;
        }
      }
      playPadNote(frequency, 0.22, 0.23, "triangle");
      $(this).addClass("active");
      setTimeout(() => $(this).removeClass("active"), 130);
      track("quiz_music_pad", {
        note: frequency,
        quiz_id: window.pageMeta?.quizId || null,
      });
    });

    $(document).on("input", ".tempo-slider", function () {
      $(".tempo-value").text($(this).val() + " BPM");
    });

    $(document).on("click", ".seq-step", function () {
      $(this).toggleClass("active");
    });

    $(document).on("click", ".seq-toggle-btn", async function () {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch (err) {
          return;
        }
      }

      if (sequencerTimer) {
        clearInterval(sequencerTimer);
        sequencerTimer = null;
        clearSequencerPulse();
        $(this).text("Play Loop").removeClass("is-live");
        track("quiz_sequencer_stop", { quiz_id: window.pageMeta?.quizId || null });
        return;
      }

      const bpm = Number($(".tempo-slider").val() || 108);
      const stepMs = Math.round((60000 / bpm) / 2);
      sequencerStep = 0;
      runSequencerTick();
      sequencerTimer = setInterval(runSequencerTick, stepMs);
      $(this).text("Stop Loop").addClass("is-live");
      track("quiz_sequencer_start", { quiz_id: window.pageMeta?.quizId || null, bpm: bpm });
    });
  });
})();
