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

    $(document).on("submit", ".quiz-form", function () {
      const quizId = $(this).data("quiz-id");
      track("quiz_submit_click", { quiz_id: quizId });
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
  });
})();
