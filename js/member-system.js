/**
 * ULUÇEEİT - Ortak Üye ve Dijital Kart Yönetim Sistemi (v2.0)
 * Çok sayfalı mimaride oturum sürekliliği, kalıcı çerez (cookie) yedeği,
 * MantleDB bulut senkronizasyonu ve VIP dijital kart modal motoru.
 */

(function (window, document) {
    'use strict';

    const STORAGE_KEY = 'ceko_member_card_data_2026';
    const COOKIE_NAME = 'ceko_member_data_2026';
    const MEMBERS_CACHE_KEY = 'uluceeit_all_members_cache';
    const GIFTS_REGISTRY_KEY = 'uluceeit_gifts_registry_v2';
    const SECRET_AUTH_TOKEN = 'CEEIT-2026-ONAY';

    // =========================================================================
    // 🍪 ÇEREZ (COOKIE) YEDEĞİ - SAYFA GEÇİŞLERİ VE SAFARI / WEBKIT GÜVENCESİ
    // =========================================================================
    function setMemberCookie(member) {
        try {
            const dataStr = encodeURIComponent(JSON.stringify(member));
            const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
            document.cookie = `${COOKIE_NAME}=${dataStr}; expires=${expires}; path=/; SameSite=Lax`;
        } catch (e) {
            console.warn('Cookie save warning:', e);
        }
    }

    function getMemberCookie() {
        try {
            const nameEQ = COOKIE_NAME + '=';
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) {
                    const raw = decodeURIComponent(c.substring(nameEQ.length, c.length));
                    return JSON.parse(raw);
                }
            }
        } catch (e) {
            console.warn('Cookie parse warning:', e);
        }
        return null;
    }

    function deleteMemberCookie() {
        try {
            document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
        } catch (e) {}
    }

    // =========================================================================
    // 💾 ÇİFT KATMANLI YEREL DEPOLAMA (LOCALSTORAGE + COOKIE FALLBACK)
    // =========================================================================
    function getStoredMember() {
        try {
            const local = localStorage.getItem(STORAGE_KEY);
            if (local) {
                const parsed = JSON.parse(local);
                if (parsed && (parsed.fullName || parsed.studentNo)) {
                    // Cookie senkronunu tazele
                    setMemberCookie(parsed);
                    return parsed;
                }
            }
        } catch (e) {}

        // LocalStorage boşsa veya temizlendiyse çerezden kurtar
        const fromCookie = getMemberCookie();
        if (fromCookie && (fromCookie.fullName || fromCookie.studentNo)) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(fromCookie));
            } catch (e) {}
            return fromCookie;
        }

        return null;
    }

    function saveStoredMember(member) {
        if (!member) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(member));
        } catch (e) {}
        setMemberCookie(member);
        updateNavbarCardState();
        CloudSync.registerMember(member).catch(() => {});
    }

    function removeStoredMember() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
        deleteMemberCookie();
        updateNavbarCardState();
    }

    // =========================================================================
    // 🌐 BULUT VERİTABANI MOTORU (MantleDB v2 & Local Fallback)
    // =========================================================================
    const CloudSync = {
        API_BASE: 'https://mantledb.sh/v2/uluceeit_live_db_2026',
        API_KEY: '5f6021b53f796c10f4a0cc12d16f6bc2598f1497ed1976e14dc12049f6709c40',

        getHeaders() {
            return {
                'Content-Type': 'application/json',
                'X-Mantle-Key': this.API_KEY
            };
        },

        async getMembers() {
            try {
                const res = await fetch(`${this.API_BASE}/members`, {
                    headers: { 'X-Mantle-Key': this.API_KEY }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        localStorage.setItem(MEMBERS_CACHE_KEY, JSON.stringify(data));
                        return data;
                    }
                }
            } catch (e) {
                console.warn('MantleDB members fetch error, fallback to cache:', e);
            }
            const cached = localStorage.getItem(MEMBERS_CACHE_KEY);
            return cached ? JSON.parse(cached) : [];
        },

        async pushMembers(members) {
            try {
                localStorage.setItem(MEMBERS_CACHE_KEY, JSON.stringify(members));
                await fetch(`${this.API_BASE}/members`, {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(members)
                });
            } catch (e) {
                console.warn('MantleDB members push error:', e);
            }
        },

        async getGifts() {
            try {
                const res = await fetch(`${this.API_BASE}/gifts`, {
                    headers: { 'X-Mantle-Key': this.API_KEY }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        localStorage.setItem(GIFTS_REGISTRY_KEY, JSON.stringify(data));
                        return data;
                    }
                }
            } catch (e) {
                console.warn('MantleDB gifts fetch error, using local cache:', e);
            }
            const cached = localStorage.getItem(GIFTS_REGISTRY_KEY);
            return cached ? JSON.parse(cached) : [];
        },

        async registerMember(member) {
            try {
                if (!member || !member.studentNo) return;
                const members = await this.getMembers();
                const sNo = String(member.studentNo).trim();
                const idx = members.findIndex(m => String(m.studentNo || '').trim() === sNo);
                if (idx >= 0) {
                    members[idx] = { ...members[idx], ...member };
                } else {
                    members.push(member);
                }
                await this.pushMembers(members);
            } catch (e) {
                console.error('Member cloud sync error:', e);
            }
        },

        async checkGiftForStudent(studentNo) {
            try {
                if (!studentNo) return null;
                const sNo = String(studentNo).trim();
                const gifts = await this.getGifts();
                const gift = gifts.find(g => String(g.target || '').trim() === sNo);
                return gift || null;
            } catch (e) {
                return null;
            }
        },

        async restoreMemberByStudentNo(studentNo) {
            try {
                const sNo = String(studentNo).trim();
                if (!sNo) return null;
                const members = await this.getMembers();
                const member = members.find(m => String(m.studentNo || '').trim() === sNo);
                if (member) {
                    saveStoredMember(member);
                    return member;
                }
            } catch (e) {}
            return null;
        },

        async recordVisit(pageName) {
            try {
                const sessionKey = `visited_session_${pageName}`;
                if (sessionStorage.getItem(sessionKey)) return;
                sessionStorage.setItem(sessionKey, 'true');

                const res = await fetch(`${this.API_BASE}/analytics`, {
                    headers: { 'X-Mantle-Key': this.API_KEY }
                });
                let stats = { totalViews: 0, lastVisit: new Date().toISOString() };
                if (res.ok) {
                    const data = await res.json();
                    if (data && typeof data === 'object') stats = { ...stats, ...data };
                }
                stats.totalViews = (stats.totalViews || 0) + 1;
                stats[`${pageName}Views`] = (stats[`${pageName}Views`] || 0) + 1;
                stats.lastVisit = new Date().toISOString();

                await fetch(`${this.API_BASE}/analytics`, {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(stats)
                });
            } catch (e) {}
        }
    };

    // =========================================================================
    // 🧭 NAVBAR KART DURUMU GÜNCELLEMESİ (TÜM SAYFALARDA BİREBİR AYNI GÖRÜNÜM)
    // =========================================================================
    function updateNavbarCardState() {
        const member = getStoredMember();
        const btnText = document.getElementById('navCardBtnText');
        const navBtn = document.getElementById('navCardBtn');
        const mobileBtn = document.getElementById('mobileNavCardBtn');
        const mobileBtnText = document.getElementById('mobileNavCardBtnText');
        const drawerBtn = document.getElementById('mobileDrawerCardBtn');
        const drawerBtnText = document.getElementById('mobileDrawerCardBtnText');
        const bottomNavCardLabel = document.getElementById('bottomNavCardLabel');

        if (member && member.fullName) {
            const firstName = member.fullName.trim().split(' ')[0] || 'Üye';

            // Masaüstü Butonu -> Yeşil Zümrüt (Aktif Üye)
            if (btnText) btnText.innerHTML = `🟢 🪪 ${firstName} (Kartım)`;
            if (navBtn) {
                navBtn.className = "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-400 hover:shadow-emerald-500/30 transform hover:-translate-y-0.5";
            }

            // Mobil Üst Buton
            if (mobileBtnText) mobileBtnText.innerHTML = `🟢 ${firstName}`;
            if (mobileBtn) {
                mobileBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-white flex items-center gap-1.5 transition-all active:scale-95 shadow-sm";
            }

            // Mobil Açılır Menü (Drawer) Butonu
            if (drawerBtnText) drawerBtnText.innerHTML = `🟢 🪪 ${member.fullName} (Kartımı Aç)`;
            if (drawerBtn) {
                drawerBtn.className = "w-full text-center bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-3.5 rounded-xl font-black shadow-md flex items-center justify-center gap-2 transition-all";
            }

            // Mobil Alt Gezinme Çubuğu (Bottom Tab Bar)
            if (bottomNavCardLabel) {
                bottomNavCardLabel.innerHTML = `🟢 ${firstName}`;
                bottomNavCardLabel.classList.add('text-emerald-400');
            }
        } else {
            // Giriş Yapılmamış / Kart Bekleniyor -> Asil Altın Sarısı
            if (btnText) btnText.innerHTML = `🪪 Dijital Üye Kartı`;
            if (navBtn) {
                navBtn.className = "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-400 hover:shadow-amber-500/30 transform hover:-translate-y-0.5";
            }

            // Mobil Üst Buton
            if (mobileBtnText) mobileBtnText.innerHTML = `Kartım`;
            if (mobileBtn) {
                mobileBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 flex items-center gap-1.5 transition-all active:scale-95 shadow-sm";
            }

            // Mobil Açılır Menü (Drawer) Butonu
            if (drawerBtnText) drawerBtnText.innerHTML = `🪪 Dijital Üye Kartını Aç / Tanımla`;
            if (drawerBtn) {
                drawerBtn.className = "w-full text-center bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-4 py-3.5 rounded-xl font-black shadow-md flex items-center justify-center gap-2 transition-all";
            }

            // Mobil Alt Gezinme Çubuğu (Bottom Tab Bar)
            if (bottomNavCardLabel) {
                bottomNavCardLabel.innerHTML = `Kartım`;
                bottomNavCardLabel.classList.remove('text-emerald-400');
            }
        }
    }

    // =========================================================================
    // 🪪 DİJİTAL KART TIKLAMA VE AÇILMA MANTIĞI
    // =========================================================================
    function handleMemberCardClick() {
        closeMobileMenu();
        const member = getStoredMember();

        if (member && member.fullName) {
            renderMemberCard(member);
            const modal = document.getElementById('memberCardModal');
            if (modal) modal.classList.remove('hidden');
        } else {
            // Henüz kart oluşturulmamışsa bilgilendirme/geri yükleme modalını aç
            const unregistered = document.getElementById('unregisteredModal');
            if (unregistered) {
                unregistered.classList.remove('hidden');
            } else {
                openActivationModal();
            }
        }
    }

    function closeMemberCardModal() {
        const modal = document.getElementById('memberCardModal');
        if (modal) modal.classList.add('hidden');
    }

    function closeUnregisteredModal() {
        const modal = document.getElementById('unregisteredModal');
        if (modal) modal.classList.add('hidden');
    }

    function openActivationModal() {
        closeMobileMenu();
        closeUnregisteredModal();
        const member = getStoredMember();
        if (member && member.fullName) {
            handleMemberCardClick();
            return;
        }
        const modal = document.getElementById('activationModal');
        if (modal) {
            modal.classList.remove('hidden');
            const input = document.getElementById('inputFullName');
            if (input) setTimeout(() => input.focus(), 200);
        }
    }

    function closeActivationModal() {
        const modal = document.getElementById('activationModal');
        if (modal) modal.classList.add('hidden');
    }

    // =========================================================================
    // ✍️ STANT KAYIT FORMU GÖNDERİMİ (CANLI AKTİVASYON)
    // =========================================================================
    async function handleActivationSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();
        const nameInput = document.getElementById('inputFullName');
        const noInput = document.getElementById('inputStudentNo');
        if (!nameInput || !noInput) return;

        const fullName = nameInput.value.trim();
        const studentNo = noInput.value.trim();
        if (!fullName || !studentNo) return;

        const randomCode = Math.floor(1000 + Math.random() * 9000);
        const serialNo = `ULU-2026-${randomCode}`;
        const newMember = {
            fullName,
            studentNo,
            serialNo,
            activatedAt: new Date().toISOString(),
            status: 'active'
        };

        saveStoredMember(newMember);
        closeActivationModal();

        if (typeof confetti === 'function') {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }

        setTimeout(() => {
            handleMemberCardClick();
        }, 300);
    }

    // =========================================================================
    // 🔄 KARTIMI GERİ YÜKLE (BULUTTAN ÖĞRENCİ NO İLE ÇEKME)
    // =========================================================================
    function toggleRestoreCardForm() {
        const cont = document.getElementById('restoreCardContainer');
        const chev = document.getElementById('restoreChevron');
        if (cont) {
            cont.classList.toggle('hidden');
            if (chev) chev.classList.toggle('rotate-180');
        }
    }

    async function handleRestoreMemberCard(e) {
        if (e && e.preventDefault) e.preventDefault();
        const input = document.getElementById('restoreStudentNoInput');
        const status = document.getElementById('restoreStatusMsg');
        const btn = document.getElementById('btnRestoreCardSubmit');
        if (!input) return;

        const studentNo = input.value.trim();
        if (!studentNo) return;

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Doğrulanıyor...</span>`;
        }
        if (status) {
            status.className = "text-[11px] font-bold text-amber-300 block";
            status.textContent = "Bulut veritabanında üyelik kaydınız aranıyor...";
        }

        try {
            const restored = await CloudSync.restoreMemberByStudentNo(studentNo);
            if (restored) {
                if (status) {
                    status.className = "text-[11px] font-bold text-emerald-400 block";
                    status.textContent = `✓ Başarılı! Hoş geldin, ${restored.fullName}. Kartınız tanımlandı.`;
                }
                if (typeof confetti === 'function') {
                    confetti({ particleCount: 80, spread: 60 });
                }
                setTimeout(() => {
                    closeUnregisteredModal();
                    handleMemberCardClick();
                }, 700);
            } else {
                if (status) {
                    status.className = "text-[11px] font-bold text-rose-400 block";
                    status.textContent = "Kayıt bulunamadı. Stanttan yeni kayıt oluşturabilir veya SKS kaydınızı yapabilirsiniz.";
                }
            }
        } catch (err) {
            if (status) {
                status.className = "text-[11px] font-bold text-rose-400 block";
                status.textContent = "Bağlantı hatası, lütfen tekrar deneyin.";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-id-card"></i> <span>Kartımı Bu Telefona Geri Mühürle</span>`;
            }
        }
    }

    // =========================================================================
    // 🎨 VIP DİJİTAL SIVI CAM ÜYE KARTI RENDER MOTORU
    // =========================================================================
    let cardClockInterval = null;

    function renderMemberCard(member) {
        const modal = document.getElementById('memberCardModal');
        if (!modal) return;

        // Kart elemanlarını güncelle
        const nameEl = document.getElementById('cardMemberName');
        const numEl = document.getElementById('cardStudentNo');
        const serialEl = document.getElementById('cardSerialNo');
        const avatarEl = document.getElementById('cardMemberAvatar');
        const qrContainer = document.getElementById('cardQrCode');
        const ticketCont = document.getElementById('cardGiveawayTicketContainer');
        const ticketNum = document.getElementById('cardGiveawayTicketNumber');

        const resolvedName = document.getElementById('cardHolderName') || document.getElementById('cardMemberName');
        const resolvedNo = document.getElementById('cardHolderNo') || document.getElementById('cardStudentNo');
        if (resolvedName) resolvedName.textContent = (member.fullName || 'Aktif Üye').toUpperCase();
        if (resolvedNo) resolvedNo.textContent = member.studentNo || '00000000';
        if (serialEl) serialEl.textContent = member.serialNo || 'ULU-2026-VIP';

        if (avatarEl && member.fullName) {
            const parts = member.fullName.trim().split(' ');
            const initials = parts.length > 1 
                ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                : parts[0].substring(0, 2).toUpperCase();
            avatarEl.textContent = initials;
        }

        // Çekiliş Biletini Göster (Varsa)
        if (member.giveawayTicket) {
            if (ticketCont) ticketCont.classList.remove('hidden');
            if (ticketNum) ticketNum.textContent = member.giveawayTicket;
        } else {
            if (ticketCont) ticketCont.classList.add('hidden');
        }

        // Canlı QR Kod Üretimi (Varsa container)
        if (qrContainer) {
            qrContainer.innerHTML = '';
            if (typeof QRCode !== 'undefined') {
                try {
                    new QRCode(qrContainer, {
                        text: `https://uluceeit.com.tr/?uye=${encodeURIComponent(member.studentNo || '')}&kart=${encodeURIComponent(member.serialNo || '')}`,
                        width: 90,
                        height: 90,
                        colorDark: '#0b1d4a',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.M
                    });
                } catch (e) {}
            }
        }

        // Saat Sayacını Canlı Başlat
        updateCardClock();
        if (cardClockInterval) clearInterval(cardClockInterval);
        cardClockInterval = setInterval(updateCardClock, 1000);

        // Hediyeyi Kontrol Et
        const giftCont = document.getElementById('wonGiftContainer') || document.getElementById('cardWonGiftContainer');
        const giftTitle = document.getElementById('wonGiftTitle') || document.getElementById('cardWonGiftTitle');
        const giftCode = document.getElementById('wonGiftCode') || document.getElementById('cardWonGiftCode');
        if (member.wonGift && member.wonGift.code) {
            if (giftCont) giftCont.classList.remove('hidden');
            if (giftTitle) giftTitle.textContent = member.wonGift.title || 'Kazanılan Hediye';
            if (giftCode) giftCode.textContent = member.wonGift.code || '';
        } else {
            if (giftCont) giftCont.classList.add('hidden');
        }
    }

    function updateCardClock() {
        const timeEl = document.getElementById('cardLiveTimestamp') || document.getElementById('cardLiveClock');
        if (!timeEl) return;
        const now = new Date();
        const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        timeEl.textContent = `${dateStr} ${timeStr}`;
    }

    // =========================================================================
    // 🎁 TEK KULLANIMLIK HEDİYE KULLANIM VE ONAY İŞLEMLERİ
    // =========================================================================
    let currentRedeemingGift = null;
    let currentRedeemingCode = null;

    function promptRedeemGift() {
        const giftTitleEl = document.getElementById('wonGiftTitle') || document.getElementById('cardWonGiftTitle');
        const giftCodeEl = document.getElementById('wonGiftCode') || document.getElementById('cardWonGiftCode');
        const giftTitle = giftTitleEl ? giftTitleEl.textContent : 'Hediye Paketi';
        const giftCode = giftCodeEl ? giftCodeEl.textContent : '';

        const modalTitle = document.getElementById('redeemModalGiftTitle');
        if (modalTitle) modalTitle.textContent = giftTitle;
        currentRedeemingGift = giftTitle;
        currentRedeemingCode = giftCode;

        const modal = document.getElementById('redeemConfirmModal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeRedeemConfirmModal() {
        const modal = document.getElementById('redeemConfirmModal');
        if (modal) modal.classList.add('hidden');
    }

    function confirmRedeemGift() {
        closeRedeemConfirmModal();
        const member = getStoredMember();
        if (member) {
            delete member.wonGift;
            saveStoredMember(member);
        }

        const giftCont = document.getElementById('wonGiftContainer') || document.getElementById('cardWonGiftContainer');
        if (giftCont) giftCont.classList.add('hidden');

        const successTitle = document.getElementById('successModalGiftTitle');
        if (successTitle) successTitle.textContent = currentRedeemingGift || 'Hediye';

        const successTime = document.getElementById('successModalTimestamp');
        if (successTime) {
            const now = new Date();
            successTime.textContent = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR');
        }

        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });
        }

        const successModal = document.getElementById('redeemSuccessModal');
        if (successModal) successModal.classList.remove('hidden');
    }

    function closeRedeemSuccessModal() {
        const modal = document.getElementById('redeemSuccessModal');
        if (modal) modal.classList.add('hidden');
    }

    // =========================================================================
    // 🍔 MOBİL DRAWER MENÜ AÇMA / KAPATMA MOTORU
    // =========================================================================
    function closeMobileMenu() {
        const mobileMenu = document.getElementById('mobileMenu');
        const menuIcon = document.getElementById('menuIcon');
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
            if (menuIcon) {
                menuIcon.classList.remove('fa-xmark');
                menuIcon.classList.add('fa-bars');
            }
        }
    }

    function toggleMobileMenu() {
        const mobileMenu = document.getElementById('mobileMenu');
        const menuIcon = document.getElementById('menuIcon');
        if (!mobileMenu) return;
        const isClosed = mobileMenu.classList.contains('hidden');
        if (isClosed) {
            mobileMenu.classList.remove('hidden');
            if (menuIcon) {
                menuIcon.classList.remove('fa-bars');
                menuIcon.classList.add('fa-xmark');
            }
        } else {
            mobileMenu.classList.add('hidden');
            if (menuIcon) {
                menuIcon.classList.remove('fa-xmark');
                menuIcon.classList.add('fa-bars');
            }
        }
    }

    // =========================================================================
    // 🚀 SAYFA AÇILDIĞINDA OTOMATİK ÇALIŞTIRILACAK MOTOR
    // =========================================================================
    function initMemberSystem() {
        updateNavbarCardState();

        // Hamburger butonunu dinle
        const menuBtn = document.getElementById('mobileMenuBtn');
        if (menuBtn && !menuBtn._hasMemberListener) {
            menuBtn.addEventListener('click', toggleMobileMenu);
            menuBtn._hasMemberListener = true;
        }

        // URL Parametreleri (Örn: ?aktivasyon=... veya ?kayit=1)
        const params = new URLSearchParams(window.location.search);
        const token = params.get('aktivasyon') || params.get('activate');
        const isRegisterReq = params.get('kayit') === '1' || params.get('register') === '1';

        if (token === SECRET_AUTH_TOKEN || isRegisterReq) {
            setTimeout(() => {
                openActivationModal();
                if (typeof confetti === 'function' && token === SECRET_AUTH_TOKEN) {
                    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                }
            }, 300);
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Arka planda aktif üye senkronizasyonu
        const member = getStoredMember();
        if (member && member.studentNo) {
            CloudSync.checkGiftForStudent(member.studentNo).then(gift => {
                if (gift && (!member.wonGift || member.wonGift.code !== gift.code)) {
                    member.wonGift = { title: gift.title, code: gift.code, id: gift.id };
                    saveStoredMember(member);
                }
            }).catch(() => {});
        }
    }

    // Hemen çalıştır (DOM hazırsa) veya DOMContentLoaded bekle
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMemberSystem);
    } else {
        initMemberSystem();
    }

    // Tarayıcı geri-ileri butonları ve sekme değişiminde durumu tazele
    window.addEventListener('pageshow', updateNavbarCardState);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') updateNavbarCardState();
    });

    // Global fonksiyonları dışarı aktar
    window.CloudSync = CloudSync;
    window.getStoredMember = getStoredMember;
    window.saveStoredMember = saveStoredMember;
    window.removeStoredMember = removeStoredMember;
    window.updateNavbarCardState = updateNavbarCardState;
    window.handleMemberCardClick = handleMemberCardClick;
    window.closeMemberCardModal = closeMemberCardModal;
    window.closeUnregisteredModal = closeUnregisteredModal;
    window.openActivationModal = openActivationModal;
    window.closeActivationModal = closeActivationModal;
    window.handleActivationSubmit = handleActivationSubmit;
    window.toggleRestoreCardForm = toggleRestoreCardForm;
    window.handleRestoreMemberCard = handleRestoreMemberCard;
    window.toggleMobileMenu = toggleMobileMenu;
    window.closeMobileMenu = closeMobileMenu;
    window.promptRedeemGift = promptRedeemGift;
    window.confirmRedeemGift = confirmRedeemGift;
    window.SECRET_AUTH_TOKEN = SECRET_AUTH_TOKEN;
    window.openMemberCardModal = openMemberCardModal;
    window.openUnregisteredModal = openUnregisteredModal;
    window.closeRedeemConfirmModal = closeRedeemConfirmModal;
    window.closeRedeemSuccessModal = closeRedeemSuccessModal;

})(window, document);
