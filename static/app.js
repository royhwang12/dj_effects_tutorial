(function () {
  function track(eventName, payload) {
    $.ajax({
      url: "/api/track",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ event: eventName, payload: payload || {} }),
    });
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

      // Serialize form fields into an object for JSON submit
      const data = {};
      $form.serializeArray().forEach(function (item) {
        data[item.name] = item.value;
      });

      $.ajax({
        url: '/quiz/' + quizId,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
      }).done(function (resp) {
        // remove any existing feedback
        $form.find('.quiz-feedback').remove();
        // remove per-item feedback and clear previous highlights
        $form.find('.quiz-item-feedback').remove();
        $form.find('.toggle-pill, .quiz-choice').removeClass('tf-correct tf-incorrect');
        const $fb = $('<div class="quiz-feedback mt-3" />');
        if (resp && resp.ok) {
          if (resp.correct) {
            $fb.addClass('alert alert-success').text('Correct!');
          } else {
            const best = resp.best_answer || '';
            $fb.addClass('alert alert-danger').text('Incorrect. Correct: ' + best);
          }

          if (resp.next) {
            const $cont = $('<a class="btn btn-sm btn-primary ms-2">Continue</a>');
            $cont.attr('href', resp.next);
            $fb.append(' ').append($cont);
          }
          // If the server returned per-item feedback (multi true/false), render per-statement results
          if (resp.per_item && Array.isArray(resp.per_item)) {
            // disable inputs to prevent further changes
            $form.find(':input').prop('disabled', true);

            const $items = $form.find('.quiz-grid article');
            resp.per_item.forEach(function (item) {
              const idx = item.index;
              const $container = $items.eq(idx);
              if ($container && $container.length) {
                // highlight selected choice
                if (item.user) {
                  const selector = 'input[name="tf_' + idx + '"][value="' + item.user + '"]';
                  const $chosen = $container.find(selector).closest('label');
                  if (item.correct) {
                    $chosen.addClass('tf-correct');
                  } else {
                    $chosen.addClass('tf-incorrect');
                  }
                }

                // append explanation text
                const $ex = $('<div class="quiz-item-feedback mt-2" />');
                if (item.correct) {
                  $ex.addClass('alert alert-success').text(item.explanation || 'Correct');
                } else {
                  $ex.addClass('alert alert-danger').text((item.explanation ? item.explanation : 'Incorrect') + (item.expected ? ' (Expected: ' + item.expected + ')' : ''));
                }
                $container.append($ex);
              }
            });
          }
        } else {
          $fb.addClass('alert alert-warning').text('Could not submit the answer.');
        }

        $form.prepend($fb);
        // focus the feedback for accessibility
        $fb.focus();
      });
    });

    $(document).on("click", ".start-btn", function () {
      $.post("/api/start").done(function (resp) {
        if (resp && resp.next) {
          window.location.href = resp.next;
        }
      });
    });
  });
})();
