document.addEventListener("click", (event) => {
  const image = event.target.closest(".description img");

  if (!image) {
    return;
  }

  const viewer = document.createElement("div");
  viewer.className = "image-viewer";

  const enlargedImage = document.createElement("img");
  enlargedImage.src = image.src;
  enlargedImage.alt = image.alt || "";

  const closeButton = document.createElement("button");
  closeButton.className = "image-viewer-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Закрыть изображение");
  closeButton.textContent = "×";

  viewer.appendChild(enlargedImage);
  viewer.appendChild(closeButton);
  document.body.appendChild(viewer);

  document.body.style.overflow = "hidden";

  function closeViewer() {
    viewer.remove();
    document.body.style.overflow = "";
    document.removeEventListener("keydown", handleKeydown);
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      closeViewer();
    }
  }

  closeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    closeViewer();
  });

  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) {
      closeViewer();
    }
  });

  document.addEventListener("keydown", handleKeydown);
});
