import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Lock, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

type PasskeyGateScope = 'reports' | 'settings';

interface PasskeyGateProps {
    scope: PasskeyGateScope;
    title: string;
    children: ReactNode;
}

const storageKeyForScope = (scope: PasskeyGateScope) => `passkey_unlocked:${scope}`;

const PasskeyGate: React.FC<PasskeyGateProps> = ({ scope, title, children }) => {
    const { login, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const storageKey = useMemo(() => storageKeyForScope(scope), [scope]);

    const [unlocked, setUnlocked] = useState(false);
    const [email, setEmail] = useState('admin@bfp.gov');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const modalRef = useRef<HTMLDivElement | null>(null);
    const dragHandleRef = useRef<HTMLDivElement | null>(null);
    const pointerIdRef = useRef<number | null>(null);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const dragBaseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);

    // Re-check on navigation to the page (HashRouter friendly)
    useEffect(() => {
        try {
            setUnlocked(sessionStorage.getItem(storageKey) === '1');
        } catch {
            setUnlocked(false);
        }
        setError('');
        setPassword('');
    }, [location.key, storageKey]);

    // Reset modal position each time it shows
    useEffect(() => {
        if (!unlocked) {
            setDragOffset({ x: 0, y: 0 });
            dragBaseRef.current = { x: 0, y: 0 };
        }
    }, [unlocked]);

    useEffect(() => {
        if (!dragging) return;

        const onPointerMove = (e: PointerEvent) => {
            if (pointerIdRef.current == null || e.pointerId !== pointerIdRef.current) return;
            if (!dragStartRef.current) return;
            // Prevent Electron/Nativefier from interpreting this as a scroll/gesture.
            e.preventDefault();

            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;
            const next = { x: dragBaseRef.current.x + dx, y: dragBaseRef.current.y + dy };

            const rect = modalRef.current?.getBoundingClientRect();
            if (!rect) {
                setDragOffset(next);
                return;
            }

            // Keep the panel within the viewport with a small margin.
            const margin = 12;
            const halfW = rect.width / 2;
            const halfH = rect.height / 2;
            const maxX = Math.max(0, window.innerWidth / 2 - halfW - margin);
            const maxY = Math.max(0, window.innerHeight / 2 - halfH - margin);

            const clamped = {
                x: Math.min(maxX, Math.max(-maxX, next.x)),
                y: Math.min(maxY, Math.max(-maxY, next.y)),
            };
            setDragOffset(clamped);
        };

        const endDrag = () => {
            const pid = pointerIdRef.current;
            setDragging(false);
            pointerIdRef.current = null;
            dragStartRef.current = null;
            dragBaseRef.current = dragOffset;
            if (pid != null) {
                try {
                    dragHandleRef.current?.releasePointerCapture(pid);
                } catch {
                    // ignore
                }
            }
        };

        // In Electron/Nativefier, pointer events are more reliable when listened
        // to at the document level (capture phase) vs window.
        document.addEventListener('pointermove', onPointerMove, { capture: true });
        document.addEventListener('pointerup', endDrag, { capture: true, once: true });
        document.addEventListener('pointercancel', endDrag, { capture: true, once: true });

        return () => {
            document.removeEventListener('pointermove', onPointerMove, { capture: true } as AddEventListenerOptions);
            document.removeEventListener('pointerup', endDrag, { capture: true } as AddEventListenerOptions);
            document.removeEventListener('pointercancel', endDrag, { capture: true } as AddEventListenerOptions);
        };
    }, [dragging, dragOffset]);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            await login(email.trim(), password);
            sessionStorage.setItem(storageKey, '1');
            setUnlocked(true);
        } catch {
            setError('Invalid credentials or not authorized.');
        }
    };

    const locked = !unlocked;

    const handleClose = () => {
        navigate('/dashboard/devices');
    };

    return (
        <div className="relative">
            <div className={locked ? 'pointer-events-none filter blur-sm select-none' : ''} aria-hidden={locked}>
                {children}
            </div>

            {locked && (
                <div
                    className="fixed inset-0 z-[1100] min-h-screen p-4 pointer-events-auto"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] pointer-events-auto" />

                    <div
                        ref={modalRef}
                        className="fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[#3A3A3A] bg-[#141414]/95 shadow-2xl pointer-events-auto"
                        style={{
                            transform: `translate3d(calc(-50% + ${dragOffset.x}px), calc(-50% + ${dragOffset.y}px), 0)`,
                        }}
                    >
                        <div
                            ref={dragHandleRef}
                            className={[
                                'flex items-center justify-between border-b border-[#2A2A2A] px-5 py-4 select-none',
                                dragging ? 'cursor-grabbing' : 'cursor-grab',
                            ].join(' ')}
                            style={{ touchAction: 'none' }}
                            onPointerDown={(e) => {
                                if (e.pointerType === 'mouse' && e.button !== 0) return;
                                e.preventDefault();
                                pointerIdRef.current = e.pointerId;
                                dragStartRef.current = { x: e.clientX, y: e.clientY };
                                dragBaseRef.current = dragOffset;
                                setDragging(true);
                                try {
                                    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                                } catch {
                                    // ignore
                                }
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-[#E53935]/15 border border-[#E53935]/40 flex items-center justify-center">
                                    <Lock className="h-4 w-4 text-[#E53935]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold tracking-[0.22em] text-gray-400 uppercase">
                                        Passkey required
                                    </p>
                                    <p className="text-sm font-bold text-white">{title}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleClose}
                                onPointerDown={(e) => {
                                    e.stopPropagation();
                                }}
                                className="ml-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#141414] focus:ring-[#E53935]"
                                aria-label="Close and go to devices"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleUnlock} className="px-5 py-5 space-y-4">
                            <p className="text-sm text-gray-300">
                                Re-enter your admin credentials to access this section.
                            </p>

                            <div>
                                <label htmlFor={`passkey-email-${scope}`} className="block text-sm font-medium text-gray-300 mb-1">
                                    Email
                                </label>
                                <input
                                    id={`passkey-email-${scope}`}
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full px-4 py-2.5 bg-[#1F1F1F] border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:border-[#E53935] transition"
                                    placeholder="admin@bfp.gov"
                                    autoComplete="username"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor={`passkey-password-${scope}`} className="block text-sm font-medium text-gray-300 mb-1">
                                    Password
                                </label>
                                <input
                                    id={`passkey-password-${scope}`}
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full px-4 py-2.5 bg-[#1F1F1F] border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:border-[#E53935] transition"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="text-sm text-red-300 bg-red-900/40 border border-red-700 rounded-md px-3 py-2 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full inline-flex items-center justify-center rounded-md bg-[#E53935] py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Unlock'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PasskeyGate;

