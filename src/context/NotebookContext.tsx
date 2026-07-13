import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { CalculatedNotebook, Notebook, NotebookMember, NotebookMembershipRole, NotebookPlace, PendingNotebookInvitation, SavedPlace } from '../domain/models';
import { acceptNotebookInvitationRemote, fetchNotebookInvitations, isMissingSupabaseObject, runNotebookMutation } from '../data/notebookService';
import { enrichNotebookMembers, mapNotebookMembers, mapNotebookPlaces, mapNotebooks, toRemoteNotebookPlace, toRemoteNotebookPlaceUpdate } from '../data/notebookMappers';
import { calculateNotebook } from '../domain/notebookPermissions';
import { ensurePersonalNotebook, readLocalNotebookState, writeLocalNotebookState } from '../data/notebookPersistence';

export type { Notebook, NotebookPlace, PendingNotebookInvitation } from '../domain/models';

interface NotebookContextType {
    notebooks: CalculatedNotebook[];
    notebookMembers: NotebookMember[];
    addNotebook: (name: string, type: 'personal' | 'shared') => Promise<{ success: boolean; id?: string; error?: string }>;
    editNotebook: (id: string, name: string) => Promise<{ success: boolean; error?: string }>;
    deleteNotebook: (id: string) => Promise<{ success: boolean; error?: string }>;
    notebookPlaces: NotebookPlace[];
    addNotebookPlace: (notebookId: string, place: Omit<NotebookPlace, 'id' | 'createdAt' | 'updatedAt' | 'notebookId' | 'createdBy'>) => Promise<{ success: boolean; id?: string; error?: string }>;
    saveTripPlaceToLibrary: (notebookId: string, place: Pick<SavedPlace, 'name' | 'type' | 'address' | 'phone' | 'note' | 'rating'>) => Promise<{ success: boolean; id?: string; error?: string }>;
    editNotebookPlace: (id: string, placeUpdates: Partial<NotebookPlace>) => Promise<{ success: boolean; error?: string }>;
    deleteNotebookPlace: (id: string) => Promise<void>;
    bulkDeleteNotebookPlaces: (ids: string[]) => Promise<void>;
    inviteToNotebook: (notebookId: string, email: string, role?: string) => Promise<{ success: boolean; error?: string }>;
    updateNotebookMemberRole: (membershipId: string, role: Exclude<NotebookMembershipRole, 'owner'>) => Promise<void>;
    transferNotebookOwnership: (membershipId: string) => Promise<void>;
    removeNotebookMember: (membershipId: string) => Promise<void>;
    replaceLocalNotebookState: (notebooks: Notebook[], places: NotebookPlace[]) => void;
    pendingNotebookInvitations: PendingNotebookInvitation[];
    acceptNotebookInvitation: (invitationId: string) => Promise<void>;
    declineNotebookInvitation: (invitationId: string) => Promise<void>;
    isSyncing: boolean;
    libraryStatus: 'loading' | 'ready-local' | 'ready-remote' | 'remote-unavailable' | 'schema-incompatible';
    libraryError: string | null;
    retryLibrarySync: () => Promise<void>;
}

type NotebookActions = Omit<NotebookContextType, 'notebooks' | 'notebookMembers' | 'notebookPlaces' | 'pendingNotebookInvitations' | 'isSyncing' | 'libraryStatus' | 'libraryError'>;

const NotebookContext = createContext<NotebookContextType | undefined>(undefined);

export function NotebookProvider({ children }: { children: React.ReactNode }) {
    const { session, userEmail, profile } = useAuth();
    const [notebooks, setNotebooks] = useState<CalculatedNotebook[]>([]);
    const [notebookMembers, setNotebookMembers] = useState<NotebookMember[]>([]);
    const [notebookPlaces, setNotebookPlaces] = useState<NotebookPlace[]>([]);
    const [pendingNotebookInvitations, setPendingNotebookInvitations] = useState<PendingNotebookInvitation[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [libraryStatus, setLibraryStatus] = useState<NotebookContextType['libraryStatus']>('loading');
    const [libraryError, setLibraryError] = useState<string | null>(null);
    const hasLoadedRemoteRef = useRef(false);
    const remoteUserIdRef = useRef<string | null>(null);

    // Track IDs of places added locally (optimistic) that haven't been confirmed by remote refresh yet.
    // This prevents remote refresh from accidentally removing places the user just created.
    const pendingLocalIdsRef = useRef<Set<string>>(new Set());

    const isRemoteMode = isSupabaseConfigured && Boolean(session);

    const refreshContext = useCallback(async () => {
        let loadedNotebooks: Notebook[] = [];
        let loadedMembers: NotebookMember[] = [];
        let loadedPlaces: NotebookPlace[] = [];
        let loadedInvitations: PendingNotebookInvitation[] = [];
        let successRemote = false;

        if (isRemoteMode && supabase) {
            setIsSyncing(true);
            setLibraryStatus('loading');
            setLibraryError(null);
            if (remoteUserIdRef.current !== session!.user.id) {
                remoteUserIdRef.current = session!.user.id;
                hasLoadedRemoteRef.current = false;
                setNotebooks([]);
                setNotebookMembers([]);
                setNotebookPlaces([]);
            }
            try {
                loadedInvitations = await fetchNotebookInvitations(userEmail);

                // Fetch memberships
                const membershipResp = await supabase
                    .from('notebook_memberships')
                    .select('id, notebook_id, user_id, role')
                    .eq('user_id', session!.user.id);

                if (membershipResp.error) {
                    throw membershipResp.error;
                }

                const ownNotebookIds = membershipResp.data.map((m: any) => m.notebook_id) || [];

                let allNotebookIds = [...ownNotebookIds];

                // Get notebooks created by user just in case
                const nbsResp = await supabase.from('notebooks').select('id').eq('created_by', session!.user.id);
                if (nbsResp.error) throw nbsResp.error;
                if (nbsResp.data) {
                    nbsResp.data.forEach((nb: any) => {
                        if (!allNotebookIds.includes(nb.id)) allNotebookIds.push(nb.id);
                    });
                }

                if (allNotebookIds.length > 0) {
                    const [nbs, places, members] = await Promise.all([
                        supabase.from('notebooks').select('*').in('id', allNotebookIds),
                        supabase.from('notebook_places').select('*').in('notebook_id', allNotebookIds),
                        supabase.from('notebook_memberships').select('*').in('notebook_id', allNotebookIds),
                    ]);

                    if (nbs.error) throw nbs.error;
                    if (places.error) throw places.error;
                    if (members.error) throw members.error;

                    loadedMembers = mapNotebookMembers(members.data ?? []);
                    const memberUserIds = Array.from(new Set(loadedMembers.map((member) => member.userId)));
                    if (memberUserIds.length > 0) {
                        const profileResponse = await supabase.from('profiles').select('id, display_name, email, avatar_url').in('id', memberUserIds);
                        if (!profileResponse.error) {
                            loadedMembers = enrichNotebookMembers(loadedMembers, profileResponse.data ?? []);
                        }
                    }

                    if (nbs.data) {
                        loadedNotebooks = mapNotebooks(nbs.data);
                    }
                    if (places.data) {
                        loadedPlaces = mapNotebookPlaces(places.data);
                    }
                }

                for (const notebook of loadedNotebooks.filter((item) => item.createdBy === session!.user.id)) {
                    if (loadedMembers.some((member) => member.notebookId === notebook.id && member.userId === session!.user.id)) continue;
                    const membership = await supabase.from('notebook_memberships').insert({ notebook_id: notebook.id, user_id: session!.user.id, role: 'owner' }).select('id').single();
                    if (membership.error) throw membership.error;
                    loadedMembers.push({ id: membership.data.id, notebookId: notebook.id, userId: session!.user.id, role: 'owner' });
                }

                let remotePersonal = loadedNotebooks.find(n => n.type === 'personal');
                if (!remotePersonal) {
                    const { data, error } = await supabase.from('notebooks').insert({
                        name: 'Địa điểm của tôi',
                        type: 'personal',
                        created_by: session!.user.id
                    }).select('id').single();

                    if (error) throw error;
                    if (data && !error) {
                        remotePersonal = { id: data.id, name: 'Địa điểm của tôi', type: 'personal', createdBy: session!.user.id };
                        loadedNotebooks.unshift(remotePersonal);
                        const membership = await supabase.from('notebook_memberships').insert({
                            notebook_id: data.id,
                            user_id: session!.user.id,
                            role: 'owner',
                        }).select('id').single();
                        if (membership.error) {
                            await supabase.from('notebooks').delete().eq('id', data.id);
                            throw membership.error;
                        }
                        loadedMembers.push({ id: membership.data.id, notebookId: data.id, userId: session!.user.id, role: 'owner' });
                    }
                }

                successRemote = true;
                hasLoadedRemoteRef.current = true;

                const localPlacesStr = localStorage.getItem('bunbietbay_notebook_places');
                if (localPlacesStr && remotePersonal) {
                    try {
                        const localPlaces = JSON.parse(localPlacesStr) as NotebookPlace[];
                        const localOnlyPlaces = localPlaces.filter(p => p.notebookId === 'default-personal');
                        
                        if (localOnlyPlaces.length > 0) {
                            for (const p of localOnlyPlaces) {
                                const { data, error } = await supabase.from('notebook_places').insert(
                                    toRemoteNotebookPlace(remotePersonal.id, p, session!.user.id),
                                ).select('id').single();
                                if (error) throw error;
                                const migratedAt = new Date().toISOString();
                                const createdAt = typeof p.createdAt === 'string' ? p.createdAt : migratedAt;
                                loadedPlaces.push({
                                    ...p,
                                    id: data.id,
                                    notebookId: remotePersonal.id,
                                    createdBy: session!.user.id,
                                    createdAt,
                                    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : createdAt,
                                });
                                const remainingLocal = (JSON.parse(localStorage.getItem('bunbietbay_notebook_places') || '[]') as NotebookPlace[])
                                    .filter((place) => place.id !== p.id);
                                localStorage.setItem('bunbietbay_notebook_places', JSON.stringify(remainingLocal));
                            }
                        }
                    } catch (e) { }
                }
            } catch (err) {
                console.warn('Remote notebook fetch error', err);
                const isSchemaError = isMissingSupabaseObject(err);
                setLibraryStatus(isSchemaError ? 'schema-incompatible' : 'remote-unavailable');
                setLibraryError(isSchemaError
                    ? 'Phiên bản cơ sở dữ liệu chưa hỗ trợ Thư viện địa điểm.'
                    : 'Không thể kết nối Thư viện địa điểm. Dữ liệu gần nhất vẫn được giữ nguyên.');
            } finally {
                setIsSyncing(false);
            }
        }

        if (isRemoteMode && !successRemote) {
            if (!hasLoadedRemoteRef.current) {
                setNotebooks([]);
                setNotebookMembers([]);
                setNotebookPlaces([]);
                setPendingNotebookInvitations([]);
            }
            setIsLoaded(true);
            return;
        }

        // Fallback to local storage
        if (!successRemote) {
            loadedInvitations = [];
            const localState = readLocalNotebookState();
            loadedNotebooks = localState.notebooks;
            loadedPlaces = localState.places;
        }

        loadedNotebooks = ensurePersonalNotebook(loadedNotebooks);

        // Preserve any pending optimistic places that remote hasn't confirmed yet
        const pendingIds = pendingLocalIdsRef.current;
        if (pendingIds.size > 0) {
            setNotebookPlaces(prev => {
                const pendingPlaces = prev.filter(p => pendingIds.has(p.id) && !loadedPlaces.some(lp => lp.id === p.id));
                return [...loadedPlaces, ...pendingPlaces];
            });
        } else {
            setNotebookPlaces(loadedPlaces);
        }

        const calculatedNotebooks = loadedNotebooks.map((notebook) => calculateNotebook(notebook, session?.user.id, loadedMembers));
        setNotebooks(calculatedNotebooks);
        setNotebookMembers(loadedMembers);
        setPendingNotebookInvitations(loadedInvitations);
        setLibraryStatus(successRemote ? 'ready-remote' : 'ready-local');
        setLibraryError(null);
        setIsLoaded(true);
    }, [isRemoteMode, session, userEmail]);

    useEffect(() => {
        refreshContext();
    }, [refreshContext]);

    useEffect(() => {
        if (!isRemoteMode || !supabase || !userEmail) {
            return;
        }

        const client = supabase;
        let isSubscribed = true;
        const channel = client
            .channel('public:notebook_invitations:notebookContext')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notebook_invitations',
                    filter: `email=eq.${userEmail.toLowerCase()}`,
                },
                (payload) => {
                    if (!isSubscribed) return;
                    void refreshContext().catch((error) => {
                        console.error('Failed to refresh notebook invitations from realtime event', error);
                    });
                    if (payload.eventType === 'INSERT' && typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('new_notebook_invitation_event'));
                    }
                }
            )
            .subscribe();

        return () => {
            isSubscribed = false;
            void client.removeChannel(channel);
        };
    }, [isRemoteMode, refreshContext, userEmail]);

    // Local Sync Dump when offline or not registered to backend
    useEffect(() => {
        if (!isLoaded || isRemoteMode) return;
        writeLocalNotebookState(notebooks, notebookPlaces);
    }, [notebookPlaces, notebooks, isLoaded, isRemoteMode]);

    const addNotebook = async (name: string, type: 'personal' | 'shared'): Promise<{ success: boolean; id?: string; error?: string }> => {
        try {
            if (isRemoteMode && libraryStatus !== 'ready-remote') throw new Error('Thư viện cloud đang không khả dụng. Hãy thử đồng bộ lại trước khi chỉnh sửa.');
            let id = 'nb_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

            let ownerMembership: NotebookMember | null = null;
            if (isRemoteMode && supabase) {
                const { data, error } = await supabase.from('notebooks').insert({
                    name, type, created_by: session!.user.id
                }).select('id').single();

                if (error) {
                    throw error;
                }
                if (data) id = data.id;

                // Create membership for creator so notebook is visible after refresh
                const { data: membershipData, error: membershipError } = await supabase.from('notebook_memberships').insert({
                    notebook_id: id,
                    user_id: session!.user.id,
                    role: 'owner',
                }).select('id').single();
                if (membershipError) {
                    await supabase.from('notebooks').delete().eq('id', id);
                    throw membershipError;
                }
                ownerMembership = { id: membershipData.id, notebookId: id, userId: session!.user.id, role: 'owner' };
            }

            const localMembership = ownerMembership ?? {
                id: `local-owner-${id}`,
                notebookId: id,
                userId: session?.user?.id ?? 'local-user',
                role: 'owner' as const,
            };
            if (ownerMembership) setNotebookMembers(prev => [...prev, ownerMembership]);
            setNotebooks(prev => [...prev, calculateNotebook(
                { id, name, type, createdBy: session?.user?.id },
                session?.user?.id ?? 'local-user',
                [localMembership],
            )]);
            return { success: true, id };
        } catch (error: any) {
            return { success: false, error: 'Database Error: ' + error.message };
        }
    };

    const editNotebook = async (id: string, name: string): Promise<{ success: boolean; error?: string }> => {
        const current = notebooks.find((item) => item.id === id);
        const nextName = name.trim();
        if (!current?.permissions.canManageMembers) return { success: false, error: 'Bạn không có quyền sửa thông tin bộ sưu tập.' };
        if (!nextName) return { success: false, error: 'Tên bộ sưu tập không được để trống.' };
        if (isRemoteMode && libraryStatus !== 'ready-remote') return { success: false, error: 'Thư viện cloud đang không khả dụng.' };
        setNotebooks((items) => items.map((item) => item.id === id ? { ...item, name: nextName } : item));
        if (!isRemoteMode || !supabase) return { success: true };
        const { error } = await supabase.from('notebooks').update({ name: nextName }).eq('id', id);
        if (error) {
            setNotebooks((items) => items.map((item) => item.id === id ? current : item));
            return { success: false, error: error.message };
        }
        return { success: true };
    };

    const addNotebookPlace = async (notebookId: string, place: Omit<NotebookPlace, 'id' | 'createdAt' | 'updatedAt' | 'notebookId' | 'createdBy'>) => {
        let optimisticId: string | null = null;
        try {
            if (isRemoteMode && libraryStatus !== 'ready-remote') return { success: false, error: 'Thư viện cloud đang không khả dụng.' };
            if (!notebooks.find((item) => item.id === notebookId)?.permissions.canEditPlaces) {
                return { success: false, error: 'Bạn chỉ có quyền xem Thư viện này.' };
            }
            let id = 'loc_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                try { id = crypto.randomUUID(); } catch (err) { }
            }
            optimisticId = id;

            const newPlace: NotebookPlace = {
                ...place,
                id,
                notebookId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: session?.user?.id
            };

            // Local optimistic — also track this ID so refreshContext won't remove it
            pendingLocalIdsRef.current.add(id);
            setNotebookPlaces(prev => [...prev, newPlace]);

            if (isRemoteMode && supabase) {
                // Skip remote insert for local-only notebooks (e.g. 'default-personal')
                const isNotebookUuid = /^[0-9a-fA-F]{8}-/.test(notebookId);
                if (!isNotebookUuid) {
                    return { success: true, id };
                }

                // We use a specific ID if the backend accepts UUIDs, but if backend generates UUIDs, we let it generate.
                // Our schema uses uuid default gen_random_uuid() so we don't pass id string if it doesn't match uuid format
                const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);

                const { data, error } = await supabase.from('notebook_places').insert(
                    toRemoteNotebookPlace(notebookId, place, session!.user.id, isUuid ? id : undefined),
                ).select('id').single();

                if (error) {
                    throw error;
                }
                // update local ID to remote ID if it wasn't UUID
                if (!isUuid && data && !error) {
                    pendingLocalIdsRef.current.delete(id);
                    pendingLocalIdsRef.current.add(data.id);
                    optimisticId = data.id;
                    setNotebookPlaces(prev => prev.map(p => p.id === id ? { ...p, id: data.id } : p));
                } else {
                    // Place confirmed on remote with same ID, remove from pending
                    pendingLocalIdsRef.current.delete(id);
                }
            }
            return { success: true, id: optimisticId ?? id };
        } catch (error: any) {
            if (optimisticId) {
                pendingLocalIdsRef.current.delete(optimisticId);
                setNotebookPlaces(prev => prev.filter(p => p.id !== optimisticId));
            }
            return { success: false, error: error.message || 'Lỗi không xác định khi lưu.' };
        }
    };

    const saveTripPlaceToLibrary = async (notebookId: string, place: Pick<SavedPlace, 'name' | 'type' | 'address' | 'phone' | 'note' | 'rating'>) => addNotebookPlace(notebookId, {
        name: place.name,
        type: place.type === 'hotel' ? 'hotel' : place.type === 'restaurant' ? 'restaurant' : 'other',
        address: place.address,
        phone: place.phone,
        note: place.note,
        rating: place.rating ?? 5,
        customFields: [],
        photos: [],
    });

    const editNotebookPlace = async (id: string, placeUpdates: Partial<NotebookPlace>) => {
        if (isRemoteMode && libraryStatus !== 'ready-remote') return { success: false, error: 'Thư viện cloud đang không khả dụng.' };
        const previousPlace = notebookPlaces.find(p => p.id === id);
        if (!previousPlace || !notebooks.find((item) => item.id === previousPlace.notebookId)?.permissions.canEditPlaces) {
            return { success: false, error: 'Bạn không có quyền sửa địa điểm này.' };
        }
        try {
            const updatedAt = new Date().toISOString();
            setNotebookPlaces(prev => prev.map(p => p.id === id ? { ...p, ...placeUpdates, updatedAt } : p));

            if (isRemoteMode && supabase) {
                const client = supabase;
                await runNotebookMutation(() => client.from('notebook_places').update(toRemoteNotebookPlaceUpdate(placeUpdates)).eq('id', id));
            }
            return { success: true };
        } catch (error: any) {
            if (previousPlace) {
                setNotebookPlaces(prev => prev.map(p => p.id === id ? previousPlace : p));
            }
            return { success: false, error: error.message || 'Lỗi cập nhật CSDL.' };
        }
    };

    const deleteNotebookPlace = async (id: string) => {
        if (isRemoteMode && libraryStatus !== 'ready-remote') throw new Error('Thư viện cloud đang không khả dụng.');
        const previousPlace = notebookPlaces.find(p => p.id === id);
        if (!previousPlace || !notebooks.find((item) => item.id === previousPlace.notebookId)?.permissions.canEditPlaces) throw new Error('Bạn không có quyền xóa địa điểm này.');
        const wasPending = pendingLocalIdsRef.current.has(id);
        pendingLocalIdsRef.current.delete(id);
        setNotebookPlaces(prev => prev.filter(p => p.id !== id));
        if (isRemoteMode && supabase) {
            const client = supabase;
            try {
                await runNotebookMutation(() => client.from('notebook_places').delete().eq('id', id));
            } catch (error) {
                if (wasPending) pendingLocalIdsRef.current.add(id);
                setNotebookPlaces(prev => prev.some(p => p.id === id) ? prev : [...prev, previousPlace]);
                throw error;
            }
        }
    };

    const bulkDeleteNotebookPlaces = async (ids: string[]) => {
        if (isRemoteMode && libraryStatus !== 'ready-remote') throw new Error('Thư viện cloud đang không khả dụng.');
        const previousPlaces = notebookPlaces.filter(p => ids.includes(p.id));
        if (previousPlaces.some((place) => !notebooks.find((item) => item.id === place.notebookId)?.permissions.canEditPlaces)) throw new Error('Bạn không có quyền xóa một số địa điểm đã chọn.');
        const pendingIds = ids.filter(id => pendingLocalIdsRef.current.has(id));
        ids.forEach(id => pendingLocalIdsRef.current.delete(id));
        setNotebookPlaces(prev => prev.filter(p => !ids.includes(p.id)));
        if (isRemoteMode && supabase) {
            const client = supabase;
            try {
                await runNotebookMutation(() => client.from('notebook_places').delete().in('id', ids));
            } catch (error) {
                if (previousPlaces.length > 0) {
                    pendingIds.forEach(id => pendingLocalIdsRef.current.add(id));
                    setNotebookPlaces(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        return [...prev, ...previousPlaces.filter(p => !existingIds.has(p.id))];
                    });
                }
                throw error;
            }
        }
    };

    const inviteToNotebook = async (notebookId: string, email: string, role: string = 'editor'): Promise<{ success: boolean; error?: string }> => {
        if (isRemoteMode && libraryStatus !== 'ready-remote') return { success: false, error: 'Thư viện cloud đang không khả dụng.' };
        try {
            if (!email || !email.includes('@')) {
                return { success: false, error: 'Email không hợp lệ.' };
            }
            if (!isRemoteMode || !supabase || !session) {
                return { success: false, error: 'Cần đăng nhập để mời thành viên.' };
            }
            const notebook = notebooks.find((item) => item.id === notebookId);
            if (notebook && !notebook.permissions.canInvite) {
                return { success: false, error: 'Bạn không có quyền mời thành viên vào Thư viện này.' };
            }
            const { error } = await supabase.from('notebook_invitations').insert({
                notebook_id: notebookId,
                email: email.toLowerCase().trim(),
                role,
                invited_by: session.user.id,
            });
            if (error) {
                if (error.message.includes('duplicate') || error.message.includes('unique')) {
                    return { success: false, error: 'Email này đã được mời rồi.' };
                }
                if (error.message.includes('schema cache') || error.message.includes('does not exist')) {
                    return { success: false, error: 'Bảng notebook_invitations chưa được tạo trên server.' };
                }
                throw error;
            }
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || 'Lỗi không xác định.' };
        }
    };

    const acceptNotebookInvitation = async (invitationId: string) => {
        if (isRemoteMode && libraryStatus !== 'ready-remote') throw new Error('Thư viện cloud đang không khả dụng.');
        if (!isRemoteMode || !supabase || !session || !profile?.id) {
            return;
        }

        await acceptNotebookInvitationRemote(invitationId);
        await refreshContext();
    };

    const declineNotebookInvitation = async (invitationId: string) => {
        if (isRemoteMode && libraryStatus !== 'ready-remote') throw new Error('Thư viện cloud đang không khả dụng.');
        if (!isRemoteMode || !supabase) {
            return;
        }
        const client = supabase;

        await runNotebookMutation(() => client.from('notebook_invitations').update({
            status: 'declined',
        }).eq('id', invitationId));
        await refreshContext();
    };

    const updateNotebookMemberRole = async (membershipId: string, role: Exclude<NotebookMembershipRole, 'owner'>) => {
        if (isRemoteMode && libraryStatus !== 'ready-remote') throw new Error('Thư viện cloud đang không khả dụng.');
        const previous = notebookMembers.find((item) => item.id === membershipId);
        if (!previous || previous.role === 'owner') throw new Error('Không thể thay đổi vai trò owner.');
        if (!notebooks.find((item) => item.id === previous.notebookId)?.permissions.canManageMembers) throw new Error('Bạn không có quyền quản lý thành viên.');
        setNotebookMembers((current) => current.map((item) => item.id === membershipId ? { ...item, role } : item));
        if (!isRemoteMode || !supabase) return;
        const { error } = await supabase.from('notebook_memberships').update({ role }).eq('id', membershipId);
        if (error) {
            setNotebookMembers((current) => current.map((item) => item.id === membershipId ? previous : item));
            throw error;
        }
        await refreshContext();
    };

    const removeNotebookMember = async (membershipId: string) => {
        if (isRemoteMode && libraryStatus !== 'ready-remote') throw new Error('Thư viện cloud đang không khả dụng.');
        const previous = notebookMembers.find((item) => item.id === membershipId);
        if (!previous || previous.role === 'owner') throw new Error('Không thể xóa owner khỏi Thư viện.');
        if (!notebooks.find((item) => item.id === previous.notebookId)?.permissions.canManageMembers) throw new Error('Bạn không có quyền quản lý thành viên.');
        setNotebookMembers((current) => current.filter((item) => item.id !== membershipId));
        if (!isRemoteMode || !supabase) return;
        const { error } = await supabase.from('notebook_memberships').delete().eq('id', membershipId);
        if (error) {
            setNotebookMembers((current) => [...current, previous]);
            throw error;
        }
        await refreshContext();
    };

    const transferNotebookOwnership = async (membershipId: string) => {
        if (!isRemoteMode || !supabase || libraryStatus !== 'ready-remote') throw new Error('Cần kết nối Thư viện cloud để chuyển quyền sở hữu.');
        const target = notebookMembers.find((item) => item.id === membershipId);
        const notebook = target ? notebooks.find((item) => item.id === target.notebookId) : null;
        if (!target || target.role === 'owner' || notebook?.membershipRole !== 'owner') throw new Error('Chỉ owner có thể chuyển quyền cho thành viên khác.');
        const { error } = await supabase.rpc('transfer_notebook_ownership', { target_membership_id: membershipId });
        if (error) throw error;
        await refreshContext();
    };

    const deleteNotebook = async (id: string): Promise<{ success: boolean; error?: string }> => {
        const previousNotebooks = notebooks;
        const previousPlaces = notebookPlaces;
        try {
            if (isRemoteMode && libraryStatus !== 'ready-remote') return { success: false, error: 'Thư viện cloud đang không khả dụng.' };
            if (!notebooks.find((item) => item.id === id)?.permissions.canDeleteNotebook) return { success: false, error: 'Chỉ owner mới có thể xóa Thư viện.' };
            // Remove from local state first (optimistic)
            setNotebooks(prev => prev.filter(n => n.id !== id));
            setNotebookPlaces(prev => prev.filter(p => p.notebookId !== id));

            if (isRemoteMode && supabase) {
                const isUuid = /^[0-9a-fA-F]{8}-/.test(id);
                if (isUuid) {
                    const { error } = await supabase.from('notebooks').delete().eq('id', id);
                    if (error) {
                        throw error;
                    }
                }
            }
            return { success: true };
        } catch (error: any) {
            setNotebooks(previousNotebooks);
            setNotebookPlaces(previousPlaces);
            return { success: false, error: error.message || 'Không thể xóa bộ sưu tập.' };
        }
    };

    const replaceLocalNotebookState = (nextNotebooks: Notebook[], places: NotebookPlace[]) => {
        if (isRemoteMode) throw new Error('Chỉ có thể nhập Thư viện vào workspace local.');
        setNotebooks(nextNotebooks.map((notebook) => calculateNotebook(notebook, session?.user.id, [])));
        setNotebookPlaces(places);
    };

    const actionHandlers: NotebookActions = {
        addNotebook, editNotebook, deleteNotebook, addNotebookPlace, saveTripPlaceToLibrary,
        editNotebookPlace, deleteNotebookPlace, bulkDeleteNotebookPlaces, inviteToNotebook,
        updateNotebookMemberRole, transferNotebookOwnership, removeNotebookMember, replaceLocalNotebookState,
        acceptNotebookInvitation, declineNotebookInvitation, retryLibrarySync: refreshContext,
    };
    const actionHandlersRef = useRef(actionHandlers);
    actionHandlersRef.current = actionHandlers;
    const stableActions = useMemo<NotebookActions>(() => ({
        addNotebook: (...args) => actionHandlersRef.current.addNotebook(...args),
        editNotebook: (...args) => actionHandlersRef.current.editNotebook(...args),
        deleteNotebook: (...args) => actionHandlersRef.current.deleteNotebook(...args),
        addNotebookPlace: (...args) => actionHandlersRef.current.addNotebookPlace(...args),
        saveTripPlaceToLibrary: (...args) => actionHandlersRef.current.saveTripPlaceToLibrary(...args),
        editNotebookPlace: (...args) => actionHandlersRef.current.editNotebookPlace(...args),
        deleteNotebookPlace: (...args) => actionHandlersRef.current.deleteNotebookPlace(...args),
        bulkDeleteNotebookPlaces: (...args) => actionHandlersRef.current.bulkDeleteNotebookPlaces(...args),
        inviteToNotebook: (...args) => actionHandlersRef.current.inviteToNotebook(...args),
        updateNotebookMemberRole: (...args) => actionHandlersRef.current.updateNotebookMemberRole(...args),
        transferNotebookOwnership: (...args) => actionHandlersRef.current.transferNotebookOwnership(...args),
        removeNotebookMember: (...args) => actionHandlersRef.current.removeNotebookMember(...args),
        replaceLocalNotebookState: (...args) => actionHandlersRef.current.replaceLocalNotebookState(...args),
        acceptNotebookInvitation: (...args) => actionHandlersRef.current.acceptNotebookInvitation(...args),
        declineNotebookInvitation: (...args) => actionHandlersRef.current.declineNotebookInvitation(...args),
        retryLibrarySync: (...args) => actionHandlersRef.current.retryLibrarySync(...args),
    }), []);
    const contextValue = useMemo<NotebookContextType>(() => ({
        notebooks, notebookMembers, notebookPlaces, pendingNotebookInvitations,
        isSyncing, libraryStatus, libraryError, ...stableActions,
    }), [isSyncing, libraryError, libraryStatus, notebookMembers, notebookPlaces, notebooks, pendingNotebookInvitations, stableActions]);

    return (
        <NotebookContext.Provider value={contextValue}>
            {children}
        </NotebookContext.Provider>
    );
}

export function useNotebook() {
    const context = useContext(NotebookContext);
    if (context === undefined) {
        throw new Error('useNotebook must be used within a NotebookProvider');
    }
    return context;
}
