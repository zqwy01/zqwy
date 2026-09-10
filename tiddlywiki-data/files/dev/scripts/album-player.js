const player = document.querySelector('#albumPlayer');
const tracks = document.querySelectorAll('.track');

if (player && tracks.length) {
    tracks.forEach((track) => {
        const button = track.querySelector('.track-button');

        button.addEventListener('click', () => {
            const source = track.dataset.src;

            player.dataset.src = source;

            player.dispatchEvent(
                new CustomEvent('change-player-source', {
                    detail: {
                        src: source
                    }
                })
            );

            tracks.forEach((item) => {
                item.classList.toggle('is-active', item === track);
            });
        });
    });

    tracks[0].classList.add('is-active');
}
