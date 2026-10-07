const SEARCH_SOURCES = [
    {
        type: 'guest',
        module: 'guests',
        label: 'Qonaq',
        icon: 'user',
        getItems: (data) => data.guests || [],
        getText: (guest) => [guest.name, guest.phone, guest.email, guest.passportNumber, guest.id],
        getTitle: (guest) => guest.name || 'Adsız qonaq',
        getMeta: (guest) => [guest.phone, guest.email].filter(Boolean).join(' · ') || 'Qonaq profili',
        open: (guest) => window.modalManager?.showGuestDetails?.(guest.id)
    },
    {
        type: 'reservation',
        module: 'reservations',
        label: 'Rezervasiya',
        icon: 'calendar-check',
        getItems: (data) => data.reservations || [],
        getText: (reservation, data) => {
            const guest = (data.guests || []).find((item) => item.id === reservation.guestId);
            const room = (data.rooms || []).find((item) => item.id === reservation.roomId);
            return [
                reservation.publicId, reservation.id, reservation.status,
                reservation.checkIn, reservation.checkOut, guest?.name, guest?.phone,
                room?.number
            ];
        },
        getTitle: (reservation, data) => {
            const guest = (data.guests || []).find((item) => item.id === reservation.guestId);
            return guest?.name || reservation.publicId || `Rezervasiya #${reservation.id}`;
        },
        getMeta: (reservation, data) => {
            const room = (data.rooms || []).find((item) => item.id === reservation.roomId);
            return [
                reservation.publicId ? `#${reservation.publicId}` : null,
                room?.number ? `Otaq ${room.number}` : null,
                reservation.checkIn && reservation.checkOut ? `${reservation.checkIn} → ${reservation.checkOut}` : null
            ].filter(Boolean).join(' · ') || 'Rezervasiya'
        },
        open: (reservation) => window.modalManager?.showReservationDetails?.(reservation.id)
    },
    {
        type: 'room',
        module: 'rooms',
        label: 'Otaq',
        icon: 'bed',
        getItems: (data) => data.rooms || [],
        getText: (room) => [room.number, room.name, room.type, room.category, room.status, room.floor, room.id],
        getTitle: (room) => room.number ? `Otaq ${room.number}` : (room.name || 'Adsız otaq'),
        getMeta: (room) => [room.type, room.category, room.status].filter(Boolean).join(' · ') || 'Otaq',
        open: (room) => {
            if (window.roomsComponent?.setFilter) window.roomsComponent.setFilter('searchVal', room.number || room.name || '');
            window.app?.loadModule('rooms');
        }
    }
];

function normalizeSearchText(value) {
    return String(value ?? '')
        .toLocaleLowerCase('az-AZ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

export default class QuickSearch {
    constructor() {
        this.dialog = null;
        this.input = null;
        this.results = null;
        this.currentResults = [];
        this.selectedIndex = 0;
        this.boundKeydown = this.handleKeydown.bind(this);
        this.createDialog();
        document.addEventListener('keydown', this.boundKeydown);
    }

    createDialog() {
        if (!document.body || document.getElementById('quickSearchOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'quickSearchOverlay';
        overlay.className = 'quick-search-overlay';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="quick-search-dialog" role="dialog" aria-modal="true" aria-labelledby="quickSearchTitle">
                <div class="quick-search-heading">
                    <div>
                        <strong id="quickSearchTitle">Sürətli axtarış</strong>
                        <span>Qonaq, rezervasiya və otaq axtarın</span>
                    </div>
                    <button type="button" class="quick-search-close" aria-label="Axtarışı bağla">Esc</button>
                </div>
                <div class="quick-search-input-wrap">
                    <i class="fas fa-search" aria-hidden="true"></i>
                    <input id="quickSearchInput" type="search" autocomplete="off" placeholder="Ad, telefon, otaq və ya rezervasiya nömrəsi..." aria-label="Axtarış">
                    <kbd>Ctrl K</kbd>
                </div>
                <div id="quickSearchResults" class="quick-search-results" role="listbox" aria-label="Axtarış nəticələri"></div>
                <div class="quick-search-footer"><span><kbd>↑</kbd><kbd>↓</kbd> seç</span><span><kbd>Enter</kbd> aç</span><span><kbd>Esc</kbd> bağla</span></div>
            </div>
        `;
        document.body.appendChild(overlay);

        this.dialog = overlay;
        this.input = overlay.querySelector('#quickSearchInput');
        this.results = overlay.querySelector('#quickSearchResults');

        this.input.addEventListener('input', () => this.renderResults(this.input.value));
        overlay.querySelector('.quick-search-close').addEventListener('click', () => this.close());
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) this.close();
        });
    }

    handleKeydown(event) {
        const target = event.target;
        const isTyping = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            this.toggle();
            return;
        }
        if (event.key === '/' && !isTyping && !this.isOpen()) {
            event.preventDefault();
            this.open();
            return;
        }
        if (!this.isOpen()) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            this.close();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.moveSelection(1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.moveSelection(-1);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            this.openSelected();
        }
    }

    isOpen() {
        return Boolean(this.dialog && !this.dialog.hidden);
    }

    toggle() {
        this.isOpen() ? this.close() : this.open();
    }

    open() {
        if (!this.dialog) this.createDialog();
        if (!this.dialog) return;
        this.dialog.hidden = false;
        document.body.classList.add('quick-search-open');
        this.input.value = '';
        this.selectedIndex = 0;
        this.renderResults('');
        requestAnimationFrame(() => this.input.focus());
    }

    close() {
        if (!this.dialog) return;
        this.dialog.hidden = true;
        document.body.classList.remove('quick-search-open');
    }

    getSearchResults(query) {
        const data = window.app?.data || {};
        const term = normalizeSearchText(query).trim();
        const canView = (module) => !window.authManager?.canViewModule || window.authManager.canViewModule(module);
        const results = [];

        for (const source of SEARCH_SOURCES) {
            if (!canView(source.module)) continue;
            for (const item of source.getItems(data)) {
                const searchable = source.getText(item, data).filter(Boolean).map(normalizeSearchText).join(' ');
                if (!term || searchable.includes(term)) {
                    results.push({ source, item, title: source.getTitle(item, data), meta: source.getMeta(item, data) });
                }
            }
        }

        return results
            .sort((a, b) => {
                if (!term) return a.source.type.localeCompare(b.source.type);
                const aTitle = normalizeSearchText(a.title);
                const bTitle = normalizeSearchText(b.title);
                return Number(!aTitle.startsWith(term)) - Number(!bTitle.startsWith(term));
            })
            .slice(0, 30);
    }

    renderResults(query) {
        if (!this.results) return;
        if (!normalizeSearchText(query).trim()) {
            this.currentResults = [];
            this.selectedIndex = 0;
            this.results.innerHTML = '<div class="quick-search-empty"><i class="fas fa-keyboard" aria-hidden="true"></i><span>Axtarışa başlamaq üçün yazın</span></div>';
            return;
        }
        this.currentResults = this.getSearchResults(query);
        this.selectedIndex = Math.min(this.selectedIndex, Math.max(this.currentResults.length - 1, 0));
        this.results.replaceChildren();

        if (!this.currentResults.length) {
            const empty = document.createElement('div');
            empty.className = 'quick-search-empty';
            empty.innerHTML = '<i class="fas fa-search" aria-hidden="true"></i><span>Nəticə tapılmadı</span>';
            this.results.appendChild(empty);
            return;
        }

        this.currentResults.forEach((result, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `quick-search-result${index === this.selectedIndex ? ' is-selected' : ''}`;
            button.setAttribute('role', 'option');
            button.setAttribute('aria-selected', index === this.selectedIndex ? 'true' : 'false');
            button.innerHTML = `<span class="quick-search-result-icon"><i class="fas fa-${result.source.icon}" aria-hidden="true"></i></span><span class="quick-search-result-copy"><strong></strong><small></small></span><span class="quick-search-result-type"></span>`;
            button.querySelector('strong').textContent = result.title;
            button.querySelector('small').textContent = result.meta;
            button.querySelector('.quick-search-result-type').textContent = result.source.label;
            button.addEventListener('mouseenter', () => this.setSelected(index));
            button.addEventListener('click', () => this.openResult(result));
            this.results.appendChild(button);
        });
    }

    setSelected(index) {
        this.selectedIndex = Math.max(0, Math.min(index, this.currentResults.length - 1));
        this.results?.querySelectorAll('.quick-search-result').forEach((element, itemIndex) => {
            const selected = itemIndex === this.selectedIndex;
            element.classList.toggle('is-selected', selected);
            element.setAttribute('aria-selected', selected ? 'true' : 'false');
        });
    }

    moveSelection(offset) {
        if (!this.currentResults.length) return;
        const nextIndex = (this.selectedIndex + offset + this.currentResults.length) % this.currentResults.length;
        this.setSelected(nextIndex);
        this.results?.querySelectorAll('.quick-search-result')[nextIndex]?.scrollIntoView({ block: 'nearest' });
    }

    openSelected() {
        const result = this.currentResults[this.selectedIndex];
        if (result) this.openResult(result);
    }

    openResult(result) {
        this.close();
        result.source.open(result.item);
    }
}
