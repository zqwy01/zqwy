const audioPlayerSlot = document.getElementById('audioPlayerSlot');
const audioPlayer = document.getElementById('audioPlayer');

function updateAudioHeight() {
    if (audioPlayer.classList.contains('is-fixed')) {
        const height = audioPlayer.getBoundingClientRect().height;

        document.documentElement.style.setProperty(
            '--audio-height',
            `${height}px`
        );
    } else {
        document.documentElement.style.setProperty(
            '--audio-height',
            '0px'
        );
    }
}

const intersectionObserver = new IntersectionObserver(
    ([entry]) => {
        audioPlayer.classList.toggle(
            'is-fixed',
            !entry.isIntersecting
        );

        requestAnimationFrame(updateAudioHeight);
    },
    {
        threshold: 0
    }
);

const resizeObserver = new ResizeObserver(() => {
    updateAudioHeight();
});

intersectionObserver.observe(audioPlayerSlot);
resizeObserver.observe(audioPlayer);

window.addEventListener('resize', updateAudioHeight);
window.addEventListener('orientationchange', updateAudioHeight);
