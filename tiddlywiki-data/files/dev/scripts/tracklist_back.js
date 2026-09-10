document.querySelectorAll(".album").forEach((album) => {
    const summary = album.querySelector(".album-heading");
    const content = album.querySelector(".album-content");

    summary.addEventListener("click", (event) => {
        event.preventDefault();

        // Открытие
        if (!album.open) {
            album.open = true;

            content.classList.remove("is-closing");
            content.classList.add("is-opening");

            return;
        }

        // Закрытие
        content.classList.remove("is-opening");
        content.classList.add("is-closing");

        content.addEventListener(
            "animationend",
            () => {
                album.open = false;
                content.classList.remove("is-closing");
            },
            { once: true }
        );
    });
});
