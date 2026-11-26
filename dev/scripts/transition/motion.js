/* transition/motion.js — модуль скрипта transition.js. */
export function install(P) {
  Object.assign(P, { playPageEnter });


  /* Animate .page-content as one piece so the movement is impossible to miss
     and matches the logo's overlay. The logo/search bar is a normal in-flow
     object now, so a transform on this container cannot pin it to the
     viewport. The class stays on the settled page to keep per-item stagger
     animations from replaying underneath the completed page animation. */
  function playPageEnter(content) {
    if (!content) return;
    void content.offsetWidth; // force a style flush so Firefox starts the animation
    content.classList.add("page-entering");
  }}
