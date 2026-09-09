document.querySelectorAll(".album").forEach((album) => {
    const summary = album.querySelector(".album-heading");
    const content = album.querySelector(".album-content");
    const tracks = album.querySelectorAll(".track");

    if (!summary || !content) {
        return;
    }

    const ANIMATION_DURATION = 350;

    let isAnimating = false;
    let animationTimer = null;

    /*
     * Выбор активного трека
     */
    tracks.forEach((track) => {
        const button = track.querySelector(".track-button");

        if (!button) {
            return;
        }

        button.addEventListener("click", (event) => {
            /*
             * Кнопка выбирает трек,
             * но не переключает details.
             */
            event.stopPropagation();

            tracks.forEach((item) => {
                item.classList.remove("is-active");
            });

            track.classList.add("is-active");
        });
    });

    /*
     * Клик по заголовку альбома
     */
    summary.addEventListener("click", (event) => {
        event.preventDefault();

        if (isAnimating) {
            return;
        }

        if (album.open) {
            closeAlbum();
        } else {
            openAlbum();
        }
    });

    function clearAnimationTimer() {
        if (animationTimer !== null) {
            window.clearTimeout(animationTimer);
            animationTimer = null;
        }
    }

    function removeTransitionListener() {
        content.removeEventListener(
            "transitionend",
            handleTransitionEnd
        );
    }

    function finishOpening() {
        clearAnimationTimer();
        removeTransitionListener();

        content.style.height = "auto";
        content.style.overflow = "hidden";

        content.classList.remove("is-opening");
        content.classList.remove("is-closing");
        content.classList.add("is-settled");

        isAnimating = false;
    }

    function finishClosing() {
        clearAnimationTimer();
        removeTransitionListener();

        content.style.height = "0px";
        content.style.overflow = "hidden";

        content.classList.remove("is-opening");
        content.classList.remove("is-closing");
        content.classList.remove("is-settled");

        /*
         * Закрываем details только после завершения
         * анимации высоты.
         */
        album.open = false;

        isAnimating = false;
    }

    function handleTransitionEnd(event) {
        /*
         * Нас интересует только переход высоты самого
         * album-content, а не переходы его дочерних элементов.
         */
        if (
            event.target !== content ||
            event.propertyName !== "height"
        ) {
            return;
        }

        if (content.classList.contains("is-open")) {
            finishOpening();
        } else {
            finishClosing();
        }
    }

    function waitForTransitionEnd() {
        content.addEventListener(
            "transitionend",
            handleTransitionEnd
        );

        /*
         * Запасной таймер, если transitionend
         * не сработает.
         */
        animationTimer = window.setTimeout(() => {
            if (content.classList.contains("is-open")) {
                finishOpening();
            } else {
                finishClosing();
            }
        }, ANIMATION_DURATION + 100);
    }

    function openAlbum() {
        isAnimating = true;

        clearAnimationTimer();
        removeTransitionListener();

        /*
         * Открываем details до измерения содержимого.
         * Благодаря этому album[open] получает высокий z-index.
         */
        album.open = true;

        content.classList.remove("is-settled");
        content.classList.remove("is-closing");
        content.classList.remove("is-open");

        content.classList.add("is-opening");

        content.style.height = "0px";
        content.style.overflow = "hidden";

        /*
         * Применяем начальное состояние height: 0.
         */
        content.offsetHeight;

        /*
         * Делаем содержимое видимым,
         * но пока оставляем overflow: hidden.
         */
        content.classList.add("is-open");

        const targetHeight = content.scrollHeight;

        waitForTransitionEnd();

        requestAnimationFrame(() => {
            content.style.height = `${targetHeight}px`;
        });
    }

    function closeAlbum() {
        isAnimating = true;

        clearAnimationTimer();
        removeTransitionListener();

        /*
         * Перед закрытием запрещаем выход содержимого
         * за текущие границы панели.
         */
        content.classList.remove("is-opening");
        content.classList.remove("is-settled");
        content.classList.add("is-closing");

        content.style.overflow = "hidden";

        /*
         * Если height был auto, фиксируем текущую высоту.
         */
        const currentHeight = content.getBoundingClientRect().height;

        content.style.height = `${currentHeight}px`;

        /*
         * Применяем текущую высоту до начала анимации.
         */
        content.offsetHeight;

        /*
         * Запускаем исчезновение содержимого
         * и рамки активного трека.
         */
        content.classList.remove("is-open");

        waitForTransitionEnd();

        requestAnimationFrame(() => {
            content.style.height = "0px";
        });
    }

    /*
     * Начальное состояние
     */
    if (album.open) {
        content.classList.add("is-open");
        content.classList.add("is-settled");

        content.style.height = "auto";
        content.style.overflow = "visible";
    } else {
        content.classList.remove("is-open");
        content.classList.remove("is-opening");
        content.classList.remove("is-closing");
        content.classList.remove("is-settled");

        content.style.height = "0px";
        content.style.overflow = "hidden";
    }
});
