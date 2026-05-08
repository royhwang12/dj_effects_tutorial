(function () {
  let audioContext = null;
  let quizSourceBuffer = null;
  let quizSourceLoading = null;
  let scratchSfxBuffer = null;
  let scratchSfxLoading = null;
  let scratchSfxAudio = null;
  const deckStates = new WeakMap();
  let scratchSession = null;
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

  async function playScratchSound(intensity) {
    // Primary path: direct HTML audio playback for maximum audibility/reliability.
    try {
      if (!scratchSfxAudio) {
        scratchSfxAudio = new Audio("/static/audio/scratch_sfx.mp3");
        scratchSfxAudio.preload = "auto";
      }
      const a = scratchSfxAudio.cloneNode(true);
      a.volume = Math.min(1, 0.45 + Math.min(0.45, (intensity || 0) * 0.04));
      a.playbackRate = 0.9 + Math.min(0.9, (intensity || 0) * 0.08);
      a.currentTime = 0;
      a.play().catch(function () { return; });
      return;
    } catch (err) {
      // fall through to WebAudio fallback
    }

    // Fallback: WebAudio buffer source
    const context = getAudioContext();
    if (scratchSfxBuffer == null) {
      if (scratchSfxLoading == null) {
        scratchSfxLoading = fetch("/static/audio/scratch_sfx.mp3")
          .then(function (resp) {
            if (!resp.ok) throw new Error("Unable to load scratch sfx");
            return resp.arrayBuffer();
          })
          .then(function (arr) {
            return context.decodeAudioData(arr);
          })
          .then(function (buf) {
            scratchSfxBuffer = buf;
            return buf;
          })
          .finally(function () {
            scratchSfxLoading = null;
          });
      }
      try {
        await scratchSfxLoading;
      } catch (err) {
        return;
      }
    }

    const now = context.currentTime + 0.001;
    const src = context.createBufferSource();
    src.buffer = scratchSfxBuffer;
    src.playbackRate.value = 0.9 + Math.min(0.9, (intensity || 0) * 0.08);
    const hp = context.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900 + Math.min(1800, (intensity || 0) * 170);
    const gain = context.createGain();
    const dur = Math.min(0.22, (scratchSfxBuffer?.duration || 0.18));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(context.destination);
    src.start(now);
    src.stop(now + dur);
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

  async function getQuizSourceBuffer() {
    const context = getAudioContext();
    if (quizSourceBuffer) return quizSourceBuffer;
    if (quizSourceLoading) return quizSourceLoading;

    quizSourceLoading = fetch("/static/audio/quiz_source.mp3")
      .then(function (resp) {
        if (!resp.ok) throw new Error("Unable to load quiz source mp3");
        return resp.arrayBuffer();
      })
      .then(function (arr) {
        return context.decodeAudioData(arr);
      })
      .then(function (buffer) {
        quizSourceBuffer = buffer;
        return buffer;
      })
      .finally(function () {
        quizSourceLoading = null;
      });

    return quizSourceLoading;
  }

  async function playQuizEffectSample(effect) {
    const context = getAudioContext();
    const buffer = await getQuizSourceBuffer();
    const start = context.currentTime + 0.02;
    const master = context.createGain();
    master.gain.value = 0.55;
    master.connect(context.destination);

    const src = context.createBufferSource();
    src.buffer = buffer;

    const preGain = context.createGain();
    preGain.gain.value = 0.9;
    src.connect(preGain);

    if (effect === "filter") {
      const hp = context.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(200, start);
      hp.frequency.exponentialRampToValueAtTime(7000, start + 2.4);
      hp.Q.value = 1.1;
      preGain.connect(hp);
      hp.connect(master);
    } else if (effect === "echo") {
      const delay = context.createDelay(1.2);
      const fb = context.createGain();
      delay.delayTime.value = 0.24;
      fb.gain.value = 0.45;
      preGain.connect(master);
      preGain.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(master);
    } else if (effect === "reverb") {
      const conv = context.createConvolver();
      conv.buffer = createImpulseResponse(context, 2.5, 2.4);
      preGain.connect(master);
      preGain.connect(conv);
      conv.connect(master);
    } else if (effect === "phaser") {
      const a1 = context.createBiquadFilter();
      const a2 = context.createBiquadFilter();
      const a3 = context.createBiquadFilter();
      const fb = context.createGain();
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      a1.type = "allpass";
      a2.type = "allpass";
      a3.type = "allpass";
      a1.Q.value = 10;
      a2.Q.value = 10;
      a3.Q.value = 10;
      lfo.type = "triangle";
      lfo.frequency.value = 2.6;
      lfoGain.gain.value = 5200;
      fb.gain.value = 0.58;
      lfo.connect(lfoGain);
      lfoGain.connect(a1.frequency);
      lfoGain.connect(a2.frequency);
      lfoGain.connect(a3.frequency);
      preGain.connect(a1);
      a1.connect(a2);
      a2.connect(a3);
      a3.connect(fb);
      fb.connect(a1);
      a3.connect(master);
      lfo.start(start);
      lfo.stop(start + 2.6);
    } else {
      preGain.connect(master);
    }

    src.start(start, 0, 2.6);
  }

  async function playBuiltInEffectClip(effect, amountPercent) {
    const context = getAudioContext();
    const buffer = await getQuizSourceBuffer();
    const start = context.currentTime + 0.02;
    const master = context.createGain();
    master.gain.value = 0.62;
    master.connect(context.destination);
    const src = context.createBufferSource();
    src.buffer = buffer;
    const amount = Math.max(0, Math.min(1, Number(amountPercent || 0) / 100));

    if (effect === "echo") {
      const dry = context.createGain();
      const delay = context.createDelay(1.2);
      const fb = context.createGain();
      const wet = context.createGain();
      dry.gain.value = 1;
      delay.delayTime.value = 0.24;
      fb.gain.value = 0.35 + amount * 0.4;
      wet.gain.value = 0.08 + amount * 0.65;
      src.connect(dry);
      dry.connect(master);
      src.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(master);
    } else if (effect === "phaser") {
      const a1 = context.createBiquadFilter();
      const a2 = context.createBiquadFilter();
      const a3 = context.createBiquadFilter();
      const fb = context.createGain();
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      const wet = context.createGain();

      a1.type = "allpass";
      a2.type = "allpass";
      a3.type = "allpass";
      a1.Q.value = 2 + amount * 12;
      a2.Q.value = 2 + amount * 12;
      a3.Q.value = 2 + amount * 12;
      lfo.type = "triangle";
      lfo.frequency.value = 0.65 + amount * 3.2;
      lfoGain.gain.value = 1000 + amount * 7000;
      fb.gain.value = 0.24 + amount * 0.45;
      wet.gain.value = 0.1 + amount * 0.8;

      lfo.connect(lfoGain);
      lfoGain.connect(a1.frequency);
      lfoGain.connect(a2.frequency);
      lfoGain.connect(a3.frequency);
      src.connect(a1);
      a1.connect(a2);
      a2.connect(a3);
      a3.connect(fb);
      fb.connect(a1);
      a3.connect(wet);
      wet.connect(master);
      lfo.start(start);
      lfo.stop(start + 3.0);
    } else {
      const hp = context.createBiquadFilter();
      const cutoff = cutoffFromKnob(amountPercent);
      hp.type = "highpass";
      hp.frequency.setValueAtTime(cutoff, start);
      hp.Q.value = 1.4;
      src.connect(hp);
      hp.connect(master);
    }

    src.start(start, 0, 3.0);
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

  function setDeckProgress(state, progress) {
    const p = Math.max(0, Math.min(1, progress));
    state.$deck.find(".wave-playhead").css("left", (p * 100).toFixed(2) + "%");
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

    if (sourceType === "custom" || sourceType === "project_mp3") {
      const file = $deck.find(".custom-audio-input").get(0)?.files?.[0];
      const audioEl = new Audio(
        sourceType === "project_mp3"
          ? "/static/audio/quiz_source.mp3"
          : (file ? URL.createObjectURL(file) : "")
      );
      if (sourceType === "custom" && !file) {
        return null;
      }
      audioEl.loop = true;
      const mediaSource = context.createMediaElementSource(audioEl);
      mediaSource.connect(inputNode);
      state.audioEl = audioEl;
      state.mediaSource = mediaSource;
      state.intervalId = setInterval(function () {
        const duration = audioEl.duration || 0;
        const progress = duration > 0 ? (audioEl.currentTime / duration) : 0;
        setDeckProgress(state, progress);
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
    const offLabel = sourceType === "custom"
      ? "Play Custom MP3"
      : (sourceType === "project_mp3" ? "Play Project MP3" : ($btn.data("label-off") || "Play"));
    $btn.text(isOn ? onLabel : offLabel);
    $deck.find(".deck-status-text").text(
      isOn
        ? (
            sourceType === "custom"
              ? "Deck running - custom track loaded"
              : (sourceType === "project_mp3" ? "Deck running - project MP3 loaded" : "Deck running - house loop loaded")
          )
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

    $(document).on("submit", ".quiz-form", function (e) {
      e.preventDefault();
      const $form = $(this);
      const quizId = $form.data("quiz-id");
      track("quiz_submit_click", { quiz_id: quizId });

      const $dndInputs = $form.find(".dnd-input");
      if ($dndInputs.length) {
        const hasEmpty = $dndInputs.toArray().some(function (el) { return !$(el).val(); });
        if (hasEmpty) {
          $form.find(".quiz-feedback").remove();
          const $fb = $('<div class="quiz-feedback mt-3 alert alert-warning" />').text("Match all scenarios before submitting.");
          const $slot = $form.find(".quiz-feedback-slot");
          if ($slot.length) $slot.empty().append($fb); else $form.append($fb);
          return;
        }
      }

      // serialize form fields into an object and include slider if present
      const data = {};
      $form.serializeArray().forEach(function (item) {
        data[item.name] = item.value;
      });
      const slider = $form.find('#quiz-slider').val();
      if (slider !== undefined) data['slider'] = slider;

      $.ajax({
        url: '/quiz/' + quizId,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
      }).done(function (resp) {
        // show inline feedback below question content
        $form.find('.quiz-feedback').remove();
        const $fb = $('<div class="quiz-feedback mt-3" />');
        if (resp && resp.ok) {
          if (resp.correct) {
            $fb.addClass('alert alert-success').text('Correct!');
          } else {
            $fb.addClass('alert alert-danger').text('Incorrect. Correct: ' + (resp.best_answer || ''));
            if (resp.hint) {
              const $hint = $('<div class="quiz-hint mt-2 small text-muted" />').text('Hint: ' + resp.hint);
              $fb.append($hint);
            }
          }
          const nextHref = resp.next_url || resp.next;
          if (nextHref) $fb.append(' <a class="btn btn-sm btn-primary ms-2" href="' + nextHref + '">Continue</a>');
        } else {
          $fb.addClass('alert alert-warning').text('Could not submit the answer.');
        }
        const $slot = $form.find('.quiz-feedback-slot');
        if ($slot.length) {
          $slot.empty().append($fb);
        } else {
          $form.append($fb);
        }
      }).fail(function () {
        // fallback to full form submit
        $form.off('submit').submit();
      });
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

    $(document).on("keydown", function (event) {
      const key = event.key;
      if (!window.pageMeta || !window.pageMeta.quizId) return;
      if (key < "1" || key > "4") return;
      const idx = Number(key) - 1;      
      const $choices = $('.quiz-form input[type="radio"]');
      if ($choices.length && idx < $choices.length) {
        $choices.eq(idx).prop("checked", true).trigger("change");
      }
    });

    $(document).on("click", ".quiz-sample-play, .effect-target-play", async function () {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch (err) {
          return;
        }
      }
      if ($(this).hasClass("quiz-sample-play")) {
        const effect = $(this).data("effect");
        await playQuizEffectSample(effect);
        track("quiz_sample_play", { effect: effect, quiz_id: window.pageMeta?.quizId || null });
        return;
      }

      const $panel = $(this).closest(".panel");
      const percent = Number($panel.find(".filter-percent-slider").val() || 50);
      const effect = $(this).data("effect") || "filter";
      await playBuiltInEffectClip(effect, percent);
      track("quiz_effect_clip_play", { effect: effect, effect_percent: percent, quiz_id: window.pageMeta?.quizId || null });
    });

    $(document).on("input", ".filter-percent-slider", function () {
      const value = Number($(this).val());
      $(".filter-percent-value").text(value + "%");
    });

    let draggingCard = null;
    $(document).on("dragstart", ".drag-card", function (e) {
      draggingCard = this;
      e.originalEvent.dataTransfer.setData("text/plain", $(this).data("effect"));
    });

    $(document).on("dragover", ".drop-slot", function (e) {
      e.preventDefault();
      $(this).addClass("drag-over");
    });

    $(document).on("dragleave", ".drop-slot", function () {
      $(this).removeClass("drag-over");
    });

    $(document).on("drop", ".drop-slot", function (e) {
      e.preventDefault();
      $(this).removeClass("drag-over");
      const effect = e.originalEvent.dataTransfer.getData("text/plain");
      if (!effect) return;

      const $slot = $(this);
      const idx = Number($slot.data("index"));
      const $input = $slot.closest(".drag-row").find(".dnd-input");

      const $existing = $slot.find(".drag-card");
      if ($existing.length) {
        $("#drag-bank").append($existing.first());
      }

      $(".dnd-input").each(function () {
        if ($(this).val() === effect) {
          $(this).val("");
          $(this).closest(".drag-row").find(".drop-slot .drag-card").appendTo("#drag-bank");
          $(this).closest(".drag-row").find(".drop-placeholder").show();
        }
      });

      let $card = draggingCard ? $(draggingCard) : $('#drag-bank .drag-card[data-effect="' + effect + '"]').first();
      if (!$card.length) return;
      $slot.find(".drop-placeholder").hide();
      $slot.append($card);
      $input.val(effect);
      draggingCard = null;
      track("quiz_drag_match_set", { quiz_id: window.pageMeta?.quizId || null, slot: idx, effect: effect });
    });

    $(document).on("pointerdown", ".dj-rig .jog-wheel", function (event) {
      const $wheel = $(this);
      const $deck = $wheel.closest(".dj-rig");
      const state = deckStates.get($deck.get(0));
      if (!state) return;
      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        ctx.resume().catch(function () { return; });
      }

      event.preventDefault();
      $wheel.addClass("scratching");
      const rect = $wheel.get(0).getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const startAngle = Math.atan2(event.clientY - cy, event.clientX - cx);
      scratchSession = {
        state: state,
        wheel: $wheel,
        cx: cx,
        cy: cy,
        lastAngle: startAngle,
        lastMoveTs: performance.now(),
        currentTime: state.audioEl ? (state.audioEl.currentTime || 0) : 0,
        accumTurns: 0,
        baseGain: state.gainNode.gain.value,
        filterQBefore: state.filterNode.Q.value,
        lastScratchSfxAt: 0,
      };

      if (state.audioEl) {
        state.audioEl.play().catch(function () { return; });
      }

      // Play one scratch hit per touch.
      playScratchSound(4);

      // Make scratch movement more audible while dragging.
      state.filterNode.Q.setTargetAtTime(Math.max(6, scratchSession.filterQBefore), state.context.currentTime, 0.01);
    });

    $(document).on("pointermove", function (event) {
      if (!scratchSession) return;
      const state = scratchSession.state;
      const angle = Math.atan2(event.clientY - scratchSession.cy, event.clientX - scratchSession.cx);
      let delta = angle - scratchSession.lastAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      scratchSession.lastAngle = angle;
      scratchSession.accumTurns += delta / (Math.PI * 2);

      const now = performance.now();
      const dt = Math.max(1, now - scratchSession.lastMoveTs);
      scratchSession.lastMoveTs = now;
      const angularSpeed = Math.min(8, Math.abs(delta) / (dt / 1000)); // rad/s (clamped)
      const scratchPulse = 0.82 + Math.min(0.35, angularSpeed * 0.03);
      state.gainNode.gain.setTargetAtTime(scratchSession.baseGain * scratchPulse, state.context.currentTime, 0.01);

      if (state.audioEl) {
        const dur = state.audioEl.duration || 0;
        if (dur > 0) {
          // Incremental scrub prevents snapping back on release.
          const deltaTurns = delta / (Math.PI * 2);
          const nextTime = Math.max(0, Math.min(dur, scratchSession.currentTime + deltaTurns * dur * 0.2));
          scratchSession.currentTime = nextTime;
          state.audioEl.currentTime = nextTime;
          setDeckProgress(state, nextTime / dur);
        }
      } else {
        const stepOffset = Math.round((delta / (Math.PI * 2)) * 16);
        state.step = Math.max(0, state.step + stepOffset);
        setDeckProgress(state, (state.step % 32) / 32);
      }
    });

    $(document).on("pointerup pointercancel", function () {
      if (!scratchSession) return;
      const state = scratchSession.state;
      scratchSession.wheel.removeClass("scratching");
      if (state.audioEl) {
        const dur = state.audioEl.duration || 0;
        if (dur > 0) {
          const locked = Math.max(0, Math.min(dur, scratchSession.currentTime || state.audioEl.currentTime || 0));
          state.audioEl.currentTime = locked;
          setDeckProgress(state, locked / dur);
        }
      }
      state.gainNode.gain.setTargetAtTime(scratchSession.baseGain, state.context.currentTime, 0.04);
      state.filterNode.Q.setTargetAtTime(scratchSession.filterQBefore, state.context.currentTime, 0.05);
      scratchSession = null;
    });

    function seekDeckFromWavePointer(event, $wave) {
      const $deck = $wave.closest(".dj-rig");
      const state = deckStates.get($deck.get(0));
      if (!state) return;
      const rect = $wave.get(0).getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      setDeckProgress(state, ratio);
      if (state.audioEl) {
        const dur = state.audioEl.duration || 0;
        if (dur > 0) {
          state.audioEl.currentTime = ratio * dur;
        }
      } else {
        state.step = Math.round(ratio * 32);
      }
    }

    $(document).on("pointerdown", ".dj-rig .deck-waveform", function (event) {
      const $wave = $(this);
      $wave.data("seeking", true);
      seekDeckFromWavePointer(event, $wave);
    });

    $(document).on("pointermove", ".dj-rig .deck-waveform", function (event) {
      const $wave = $(this);
      if (!$wave.data("seeking")) return;
      seekDeckFromWavePointer(event, $wave);
    });

    $(document).on("pointerup pointercancel", function () {
      $(".dj-rig .deck-waveform").data("seeking", false);
    });
    // --- Interactive SVG controls for quiz diagram ---
    function svgPoint(svg, x, y) {
      var pt = svg.createSVGPoint();
      pt.x = x; pt.y = y;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

    // Initialize overlay handlers after a short delay (ensure SVG present)
    setTimeout(function(){
      var overlay = document.querySelector('.diagram-overlay');
      if(!overlay) return;
      var svg = overlay;
      var crossHandle = svg.getElementById('cross-handle');
      var crossTrack = svg.getElementById('cross-track');
      var filterA = svg.getElementById('filter-a-handle');
      var filterB = svg.getElementById('filter-b-handle');
      var echoToggle = svg.getElementById('echo-toggle');
      var gainA = svg.getElementById('gain-a-handle');
      var gainB = svg.getElementById('gain-b-handle');

      if(!crossHandle || !crossTrack) return;

      // store original reference positions (in SVG user coordinates)
      var orig = {};

      function recalcOrig() {
        var tbox = crossTrack.getBBox();
        var hbox = crossHandle.getBBox();
        orig.crossTrack = tbox;
        orig.crossHandleCenterX = hbox.x + hbox.width/2;

        var aCircle = filterA && filterA.querySelector('circle');
        var bCircle = filterB && filterB.querySelector('circle');
        if(aCircle){ var ab = aCircle.getBBox(); orig.filterACenterY = ab.y + ab.height/2; }
        if(bCircle){ var bb = bCircle.getBBox(); orig.filterBCenterY = bb.y + bb.height/2; }

        var gaRect = gainA && gainA.querySelector('rect');
        var gbRect = gainB && gainB.querySelector('rect');
        if(gaRect){ var gab = gaRect.getBBox(); orig.gainA = gab; }
        if(gbRect){ var gbb = gbRect.getBBox(); orig.gainB = gbb; }
      }

      recalcOrig();

      var dragging = null;

      function screenToRatioX(px){
        var bbox = orig.crossTrack;
        return clamp((px - bbox.x)/bbox.width, 0, 1);
      }

      function setCrossByRatio(ratio){
        var bbox = orig.crossTrack;
        var targetCenterX = bbox.x + ratio * bbox.width;
        var dx = targetCenterX - orig.crossHandleCenterX;
        crossHandle.setAttribute('transform','translate(' + dx + ',0)');
        var val = Math.round(ratio * 100);
        var el = document.getElementById('crossfader'); if(el) el.value = val;
      }

      function setFilterByY(group, origCenterY, inputId, rangePx){
        var top = origCenterY - rangePx;
        var bottom = origCenterY + rangePx;
        var y = clamp(rangePx === 0 ? origCenterY : clamp((y = arguments[1]) , top, bottom), top, bottom);
      }

      function setFilterAByY(y){
        if(!filterA) return;
        var range = 40; // allow +/-40px around original center
        var top = orig.filterACenterY - range;
        var bottom = orig.filterACenterY + range;
        y = clamp(y, top, bottom);
        var dy = y - orig.filterACenterY;
        filterA.setAttribute('transform','translate(0,' + dy + ')');
        var val = Math.round(((bottom - y) / (bottom - top)) * 100);
        var el = document.getElementById('filter_a'); if(el) el.value = val;
      }

      function setFilterBByY(y){
        if(!filterB) return;
        var range = 40;
        var top = orig.filterBCenterY - range;
        var bottom = orig.filterBCenterY + range;
        y = clamp(y, top, bottom);
        var dy = y - orig.filterBCenterY;
        filterB.setAttribute('transform','translate(0,' + dy + ')');
        var val = Math.round(((bottom - y) / (bottom - top)) * 100);
        var el = document.getElementById('filter_b'); if(el) el.value = val;
      }

      function setGainAByY(y){
        if(!orig.gainA) return;
        var top = orig.gainA.y;
        var bottom = orig.gainA.y + orig.gainA.height;
        y = clamp(y, top, bottom);
        // visual: move the rect so its top aligns with y
        var dy = y - orig.gainA.y;
        gainA.setAttribute('transform','translate(0,' + dy + ')');
        var val = Math.round(((bottom - y) / (bottom - top)) * 100);
        var el = document.getElementById('gain_a'); if(el) el.value = val;
      }

      function setGainBByY(y){
        if(!orig.gainB) return;
        var top = orig.gainB.y;
        var bottom = orig.gainB.y + orig.gainB.height;
        y = clamp(y, top, bottom);
        var dy = y - orig.gainB.y;
        gainB.setAttribute('transform','translate(0,' + dy + ')');
        var val = Math.round(((bottom - y) / (bottom - top)) * 100);
        var el = document.getElementById('gain_b'); if(el) el.value = val;
      }

      svg.addEventListener('pointerdown', function(e){
        var target = e.target;
        // accept group children
        if(target.parentNode && target.parentNode.id === 'cross-handle') dragging = crossHandle;
        else if(target.parentNode && target.parentNode.id === 'filter-a-handle') dragging = filterA;
        else if(target.parentNode && target.parentNode.id === 'filter-b-handle') dragging = filterB;
        else if(target.parentNode && target.parentNode.id === 'gain-a-handle') dragging = gainA;
        else if(target.parentNode && target.parentNode.id === 'gain-b-handle') dragging = gainB;
        else if(target.id === 'cross-handle' || target === crossHandle) dragging = crossHandle;
        else if(target.id === 'filter-a-handle' || target === filterA) dragging = filterA;
        else if(target.id === 'filter-b-handle' || target === filterB) dragging = filterB;
        else if(target.id === 'gain-a-handle' || target === gainA) dragging = gainA;
        else if(target.id === 'gain-b-handle' || target === gainB) dragging = gainB;
        else if(target.id === 'echo-toggle' || (target.parentNode && target.parentNode.id === 'echo-toggle')) {
          // toggle echo
          var echoEl = document.getElementById('echo');
          var cur = echoEl && echoEl.value === 'true';
          if(echoEl) echoEl.value = cur ? 'false' : 'true';
          var txt = svg.querySelector('#echo-toggle text');
          if(txt) txt.textContent = 'Echo: ' + (cur ? 'OFF' : 'ON');
        }
        if(dragging){ svg.setPointerCapture(e.pointerId); }
      });

      window.addEventListener('pointermove', function(e){
        if(!dragging) return;
        var p = svgPoint(svg, e.clientX, e.clientY);
        if(dragging === crossHandle){
          var ratio = screenToRatioX(p.x);
          setCrossByRatio(ratio);
        } else if(dragging === filterA){
          setFilterAByY(p.y);
        } else if(dragging === filterB){
          setFilterBByY(p.y);
        } else if(dragging === gainA){
          setGainAByY(p.y);
        } else if(dragging === gainB){
          setGainBByY(p.y);
        }
      });

      window.addEventListener('pointerup', function(e){ dragging = null; });

      // Initialize visuals from hidden inputs
        function initializeFromInputs(){
          try{ recalcOrig(); }catch(e){ }
          var cf = document.getElementById('crossfader');
          if(cf) setCrossByRatio((Number(cf.value)||0)/100);
          var fa = document.getElementById('filter_a');
          if(fa){
            var val = clamp(Number(fa.value)||0,0,100);
            var range = 40; var top = orig.filterACenterY - range; var bottom = orig.filterACenterY + range;
            var y = bottom - (val/100)*(bottom-top);
            setFilterAByY(y);
          }
          var fb = document.getElementById('filter_b');
          if(fb){
            var valb = clamp(Number(fb.value)||0,0,100);
            var range = 40; var topb = orig.filterBCenterY - range; var bottomb = orig.filterBCenterY + range;
            var yb = bottomb - (valb/100)*(bottomb-topb);
            setFilterBByY(yb);
          }
          var ga = document.getElementById('gain_a');
          if(ga && orig.gainA){ var valga = clamp(Number(ga.value)||50,0,100); var top = orig.gainA.y; var bottom = orig.gainA.y + orig.gainA.height; var y = bottom - (valga/100)*(bottom-top); setGainAByY(y); }
          var gb = document.getElementById('gain_b');
          if(gb && orig.gainB){ var valgb = clamp(Number(gb.value)||50,0,100); var top = orig.gainB.y; var bottom = orig.gainB.y + orig.gainB.height; var y = bottom - (valgb/100)*(bottom-top); setGainBByY(y); }
        }

        // initialize now and on resize (recalculate orig boxes when layout changes)
        initializeFromInputs();
        window.addEventListener('resize', function(){ setTimeout(initializeFromInputs, 60); });

        // ---- wire visible quiz controls to hidden inputs ----
        $(document).on('input', '#quiz-crossfader-range', function(){
          var v = Number(this.value||0); $('#crossfader').val(v); // keep hidden input in sync
        });
        $(document).on('input', '#quiz-filter-range', function(){
          var v = Number(this.value||0); $('#filter_a').val(v); $('.filter-value').text(v + '%');
        });
        $(document).on('input', '#quiz-gain-a-range', function(){ $('#gain_a').val(Number(this.value||0)); });
        $(document).on('input', '#quiz-gain-b-range', function(){ $('#gain_b').val(Number(this.value||0)); });
        $(document).on('click', '.quiz-echo-toggle', function(){
          var el = $('#echo'); var cur = el.val() === 'true'; el.val(cur ? 'false' : 'true'); $(this).toggleClass('is-on', !cur); $(this).text(!cur ? 'Effect On' : 'Effect Bypass');
        });

    }, 100);
  });
})();
