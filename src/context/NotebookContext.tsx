import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type Notebook = {
    id: string;
    name: string;
    type: 'personal' | 'shared';
    createdBy?: string;
};

export type NotebookPlace = {
    id: string;
    notebookId: string;
    name: string;
    type: 'hotel' | 'restaurant' | 'cafe' | 'entertainment' | 'other';
    address?: string;
    phone?: string;
    note?: string;
    rating: number; // 1-5
    customFields?: { label: string; value: string }[];
    coverImage?: string;
    photos?: string[];
    createdAt: string;
    createdBy?: string;
};

export type PendingNotebookInvitation = {
    id: string;
    notebookId: string;
    notebookName: string;
    email: string;
    role: 'admin' | 'editor' | 'viewer';
    status: 'pending' | 'accepted' | 'declined';
    createdAt: string;
    invitedByName: string | null;
};

interface NotebookContextType {
    notebooks: Notebook[];
    addNotebook: (name: string, type: 'personal' | 'shared') => Promise<{ success: boolean; id?: string; error?: string }>;
    deleteNotebook: (id: string) => Promise<{ success: boolean; error?: string }>;
    notebookPlaces: NotebookPlace[];
    addNotebookPlace: (notebookId: string, place: Omit<NotebookPlace, 'id' | 'createdAt' | 'notebookId' | 'createdBy'>) => Promise<{ success: boolean; error?: string }>;
    editNotebookPlace: (id: string, placeUpdates: Partial<NotebookPlace>) => Promise<{ success: boolean; error?: string }>;
    deleteNotebookPlace: (id: string) => Promise<void>;
    bulkDeleteNotebookPlaces: (ids: string[]) => Promise<void>;
    inviteToNotebook: (notebookId: string, email: string, role?: string) => Promise<{ success: boolean; error?: string }>;
    pendingNotebookInvitations: PendingNotebookInvitation[];
    acceptNotebookInvitation: (invitationId: string) => Promise<void>;
    declineNotebookInvitation: (invitationId: string) => Promise<void>;
    isSyncing: boolean;
}

const NotebookContext = createContext<NotebookContextType | undefined>(undefined);

async function runSupabaseMutation(run: () => PromiseLike<{ error: unknown }>) {
    const response = await Promise.resolve(run());
    if ('error' in response && response.error) throw response.error;
}

function isMissingSupabaseObject(error: unknown) {
    const message = error instanceof Error ? error.message : String((error as any)?.message ?? error);
    return message.includes('schema cache') || message.includes('does not exist') || message.includes('relation');
}

async function fetchNotebookInvitations(email: string | null): Promise<PendingNotebookInvitation[]> {
    if (!supabase || !email) {
        return [];
    }

    const { data, error } = await supabase
        .from('notebook_invitations')
        .select(`
            id,
            notebook_id,
            email,
            role,
            status,
            created_at,
            notebooks:notebook_id(name),
            inviter:invited_by(display_name)
        `)
        .eq('email', email.toLowerCase())
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    return ((data ?? []) as any[]).map((invitation) => ({
        id: invitation.id,
        notebookId: invitation.notebook_id,
        notebookName: invitation.notebooks?.name ?? 'Sổ tay',
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        createdAt: invitation.created_at,
        invitedByName: invitation.inviter?.display_name ?? null,
    }));
}

async function acceptNotebookInvitationRemote(invitationId: string) {
    if (!supabase) {
        return;
    }

    const { error } = await supabase.rpc('accept_notebook_invitation', {
        target_invitation_id: invitationId,
    });

    if (error) {
        throw error;
    }
}

export function NotebookProvider({ children }: { children: React.ReactNode }) {
    const { session, userEmail, profile } = useAuth();
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [notebookPlaces, setNotebookPlaces] = useState<NotebookPlace[]>([]);
    const [pendingNotebookInvitations, setPendingNotebookInvitations] = useState<PendingNotebookInvitation[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Track IDs of places added locally (optimistic) that haven't been confirmed by remote refresh yet.
    // This prevents remote refresh from accidentally removing places the user just created.
    const pendingLocalIdsRef = useRef<Set<string>>(new Set());

    const isRemoteMode = isSupabaseConfigured && Boolean(session);

    const refreshContext = useCallback(async () => {
        let loadedNotebooks: Notebook[] = [];
        let loadedPlaces: NotebookPlace[] = [];
        let loadedInvitations: PendingNotebookInvitation[] = [];
        let successRemote = false;

        if (isRemoteMode && supabase) {
            setIsSyncing(true);
            try {
                try {
                    loadedInvitations = await fetchNotebookInvitations(userEmail);
                    const shouldAutoAcceptNotebooks = localStorage.getItem('autoAcceptNotebookInvites') !== 'false';
                    if (shouldAutoAcceptNotebooks && profile?.id && loadedInvitations.length > 0) {
                        const results = await Promise.allSettled(
                            loadedInvitations.map((invitation) => acceptNotebookInvitationRemote(invitation.id))
                        );
                        if (results.some((result) => result.status === 'fulfilled')) {
                            loadedInvitations = await fetchNotebookInvitations(userEmail);
                        }
                    }
                } catch (error) {
                    if (isMissingSupabaseObject(error)) {
                        console.warn('Notebook invitations are not available on this Supabase schema yet.', error);
                    } else {
                        throw error;
                    }
                }

                // Fetch memberships
                const membershipResp = await supabase
                    .from('notebook_memberships')
                    .select('notebook_id')
                    .eq('user_id', session!.user.id);

                if (membershipResp.error) {
                    if (membershipResp.error.message.includes('does not exist')) {
                        console.warn('Notebook tables not created yet, fallback local.');
                        throw new Error('Fallback local');
                    }
                    throw membershipResp.error;
                }

                const ownNotebookIds = membershipResp.data.map((m: any) => m.notebook_id) || [];

                let allNotebookIds = [...ownNotebookIds];

                // Get notebooks created by user just in case
                const nbsResp = await supabase.from('notebooks').select('id').eq('created_by', session!.user.id);
                if (!nbsResp.error && nbsResp.data) {
                    nbsResp.data.forEach((nb: any) => {
                        if (!allNotebookIds.includes(nb.id)) allNotebookIds.push(nb.id);
                    });
                }

                if (allNotebookIds.length > 0) {
                    const [nbs, places] = await Promise.all([
                        supabase.from('notebooks').select('*').in('id', allNotebookIds),
                        supabase.from('notebook_places').select('*').in('notebook_id', allNotebookIds)
                    ]);

                    if (nbs.data) {
                        loadedNotebooks = nbs.data.map((r: any) => ({
                            id: r.id, name: r.name, type: r.type, createdBy: r.created_by
                        }));
                    }
                    if (places.data) {
                        loadedPlaces = places.data.map((r: any) => ({
                            id: r.id,
                            notebookId: r.notebook_id,
                            name: r.name,
                            type: r.type,
                            address: r.address || undefined,
                            phone: r.phone || undefined,
                            note: r.note || undefined,
                            rating: Number(r.rating) || 5,
                            customFields: r.custom_fields as any,
                            coverImage: r.cover_image || undefined,
                            photos: r.photos || [],
                            createdAt: r.created_at,
                            createdBy: r.created_by
                        }));
                    }
                }

                let remotePersonal = loadedNotebooks.find(n => n.type === 'personal');
                if (!remotePersonal) {
                    const { data, error } = await supabase.from('notebooks').insert({
                        name: 'Sổ tay cá nhân',
                        type: 'personal',
                        created_by: session!.user.id
                    }).select('id').single();
                    
                    if (data && !error) {
                        remotePersonal = { id: data.id, name: 'Sổ tay cá nhân', type: 'personal', createdBy: session!.user.id };
                        loadedNotebooks.unshift(remotePersonal);
                        await supabase.from('notebook_memberships').insert({
                            notebook_id: data.id,
                            user_id: session!.user.id,
                            role: 'owner',
                        });
                    }
                }

                successRemote = true;

                const localPlacesStr = localStorage.getItem('bunbietbay_notebook_places');
                if (localPlacesStr && remotePersonal) {
                    try {
                        const localPlaces = JSON.parse(localPlacesStr) as NotebookPlace[];
                        const localOnlyPlaces = localPlaces.filter(p => p.notebookId === 'default-personal');
                        
                        if (localOnlyPlaces.length > 0) {
                            for (const p of localOnlyPlaces) {
                                const exists = loadedPlaces.some(rp => rp.notebookId === remotePersonal!.id && rp.name === p.name);
                                if (!exists) {
                                    const { data } = await supabase.from('notebook_places').insert({
                                        notebook_id: remotePersonal.id,
                                        name: p.name,
                                        type: p.type,
                                        address: p.address,
                                        phone: p.phone,
                                        note: p.note,
                                        rating: p.rating,
                                        custom_fields: p.customFields || [],
                                        cover_image: p.coverImage,
                                        photos: p.photos || [],
                                        created_by: session!.user.id
                                    }).select('id').single();
                                    
                                    if (data) {
                                        loadedPlaces.push({
                                            ...p,
                                            id: data.id,
                                            notebookId: remotePersonal.id,
                                            createdBy: session!.user.id
                                        });
                                    }
                                }
                            }
                            const remainingLocal = localPlaces.filter(p => p.notebookId !== 'default-personal');
                            localStorage.setItem('bunbietbay_notebook_places', JSON.stringify(remainingLocal));
                        }
                    } catch (e) { }
                }
            } catch (err) {
                console.warn('Remote notebook fetch error', err);
            } finally {
                setIsSyncing(false);
            }
        }

        // Fallback to local storage
        if (!successRemote) {
            loadedInvitations = [];
            const storedPlaces = localStorage.getItem('bunbietbay_notebook_places');
            const storedNotebooks = localStorage.getItem('bunbietbay_notebooks');

            if (storedNotebooks) {
                try { loadedNotebooks = JSON.parse(storedNotebooks); } catch (e) { }
            }

            if (loadedNotebooks.length === 0) {
                loadedNotebooks = [{ id: 'default-personal', name: 'Sổ tay cá nhân', type: 'personal' }];
            }

            if (storedPlaces) {
                try {
                    const parsed = JSON.parse(storedPlaces) as any[];
                    // Migrate old places
                    loadedPlaces = parsed.map(p => p.notebookId ? p : { ...p, notebookId: 'default-personal' });
                } catch (e) { }
            }
        }

        // Always ensure a personal notebook exists in the list
        if (!loadedNotebooks.some(n => n.type === 'personal')) {
            loadedNotebooks = [{ id: 'default-personal', name: 'Sổ tay cá nhân', type: 'personal' }, ...loadedNotebooks];
        }

        // Final fallback if totally empty
        if (loadedNotebooks.length === 0) {
            loadedNotebooks = [{ id: 'default-personal', name: 'Sổ tay cá nhân', type: 'personal' }];
        }

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

        setNotebooks(loadedNotebooks);
        setPendingNotebookInvitations(loadedInvitations);
        setIsLoaded(true);
    }, [isRemoteMode, profile?.id, session, userEmail]);

    useEffect(() => {
        refreshContext();
    }, [refreshContext]);

    useEffect(() => {
        if (!isRemoteMode || !supabase || !userEmail) {
            return;
        }

        let isSubscribed = true;
        const channel = supabase
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
            void supabase.removeChannel(channel);
        };
    }, [isRemoteMode, refreshContext, userEmail]);

    // Local Sync Dump when offline or not registered to backend
    useEffect(() => {
        if (!isLoaded) return;
        // Guard: never persist an empty array if we had data before (prevents accidental wipe)
        const prevPlacesStr = localStorage.getItem('bunbietbay_notebook_places');
        if (notebookPlaces.length === 0 && prevPlacesStr) {
            try {
                const prevPlaces = JSON.parse(prevPlacesStr);
                if (Array.isArray(prevPlaces) && prevPlaces.length > 0) {
                    // Skip writing empty over non-empty — likely a transient state during refresh
                    return;
                }
            } catch (e) { }
        }
        localStorage.setItem('bunbietbay_notebook_places', JSON.stringify(notebookPlaces));
        localStorage.setItem('bunbietbay_notebooks', JSON.stringify(notebooks));
    }, [notebookPlaces, notebooks, isLoaded]);

    const addNotebook = async (name: string, type: 'personal' | 'shared'): Promise<{ success: boolean; id?: string; error?: string }> => {
        try {
            let id = 'nb_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

            if (isRemoteMode && supabase) {
                const { data, error } = await supabase.from('notebooks').insert({
                    name, type, created_by: session!.user.id
                }).select('id').single();

                if (error) {
                    if (error.message.includes('schema cache') || error.message.includes('does not exist')) {
                        console.warn('Backend notebook tables missing. Falling back to local storage.');
                    } else {
                        throw error;
                    }
                }
                if (data) id = data.id;

                // Create membership for creator so notebook is visible after refresh
                const { error: membershipError } = await supabase.from('notebook_memberships').insert({
                    notebook_id: id,
                    user_id: session!.user.id,
                    role: 'owner',
                });
                if (membershipError) {
                    console.warn('Could not create notebook membership:', membershipError.message);
                }
            }

            setNotebooks(prev => [...prev, { id, name, type, createdBy: session?.user?.id }]);
            return { success: true, id };
        } catch (error: any) {
            return { success: false, error: 'Database Error: ' + error.message };
        }
    };

    const addNotebookPlace = async (notebookId: string, place: Omit<NotebookPlace, 'id' | 'createdAt' | 'notebookId' | 'createdBy'>) => {
        let optimisticId: string | null = null;
        try {
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
                createdBy: session?.user?.id
            };

            // Local optimistic — also track this ID so refreshContext won't remove it
            pendingLocalIdsRef.current.add(id);
            setNotebookPlaces(prev => [...prev, newPlace]);

            if (isRemoteMode && supabase) {
                // Skip remote insert for local-only notebooks (e.g. 'default-personal')
                const isNotebookUuid = /^[0-9a-fA-F]{8}-/.test(notebookId);
                if (!isNotebookUuid) {
                    return { success: true };
                }

                // We use a specific ID if the backend accepts UUIDs, but if backend generates UUIDs, we let it generate.
                // Our schema uses uuid default gen_random_uuid() so we don't pass id string if it doesn't match uuid format
                const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);

                const { data, error } = await supabase.from('notebook_places').insert({
                    ...(isUuid ? { id } : {}),
                    notebook_id: notebookId,
                    name: place.name,
                    type: place.type,
                    address: place.address,
                    phone: place.phone,
                    note: place.note,
                    rating: place.rating,
                    custom_fields: place.customFields || [],
                    cover_image: place.coverImage,
                    photos: place.photos || [],
                    created_by: session!.user.id
                }).select('id').single();

                if (error) {
                    if (error.message.includes('schema cache') || error.message.includes('does not exist')) {
                        console.warn('Backend notebook_places table missing. Falling back to local storage.');
                    } else {
                        throw error;
                    }
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
            return { success: true };
        } catch (error: any) {
            if (optimisticId) {
                pendingLocalIdsRef.current.delete(optimisticId);
                setNotebookPlaces(prev => prev.filter(p => p.id !== optimisticId));
            }
            return { success: false, error: error.message || 'Lỗi không xác định khi lưu.' };
        }
    };

    const editNotebookPlace = async (id: string, placeUpdates: Partial<NotebookPlace>) => {
        const previousPlace = notebookPlaces.find(p => p.id === id);
        try {
            setNotebookPlaces(prev => prev.map(p => p.id === id ? { ...p, ...placeUpdates } : p));

            if (isRemoteMode && supabase) {
                await runSupabaseMutation(() => supabase.from('notebook_places').update({
                    name: placeUpdates.name,
                    type: placeUpdates.type,
                    address: placeUpdates.address,
                    phone: placeUpdates.phone,
                    note: placeUpdates.note,
                    rating: placeUpdates.rating,
                    custom_fields: placeUpdates.customFields,
                    cover_image: placeUpdates.coverImage,
                    photos: placeUpdates.photos
                }).eq('id', id));
            }
            return { success: true };
        } catch (error: any) {
            if (previousPlace && !isMissingSupabaseObject(error)) {
                setNotebookPlaces(prev => prev.map(p => p.id === id ? previousPlace : p));
            }
            return { success: false, error: error.message || 'Lỗi cập nhật CSDL.' };
        }
    };

    const deleteNotebookPlace = async (id: string) => {
        const previousPlace = notebookPlaces.find(p => p.id === id);
        const wasPending = pendingLocalIdsRef.current.has(id);
        pendingLocalIdsRef.current.delete(id);
        setNotebookPlaces(prev => prev.filter(p => p.id !== id));
        if (isRemoteMode && supabase) {
            try {
                await runSupabaseMutation(() => supabase.from('notebook_places').delete().eq('id', id));
            } catch (error) {
                if (previousPlace && !isMissingSupabaseObject(error)) {
                    if (wasPending) pendingLocalIdsRef.current.add(id);
                    setNotebookPlaces(prev => prev.some(p => p.id === id) ? prev : [...prev, previousPlace]);
                }
            }
        }
    };

    const bulkDeleteNotebookPlaces = async (ids: string[]) => {
        const previousPlaces = notebookPlaces.filter(p => ids.includes(p.id));
        const pendingIds = ids.filter(id => pendingLocalIdsRef.current.has(id));
        ids.forEach(id => pendingLocalIdsRef.current.delete(id));
        setNotebookPlaces(prev => prev.filter(p => !ids.includes(p.id)));
        if (isRemoteMode && supabase) {
            try {
                await runSupabaseMutation(() => supabase.from('notebook_places').delete().in('id', ids));
            } catch (error) {
                if (previousPlaces.length > 0 && !isMissingSupabaseObject(error)) {
                    pendingIds.forEach(id => pendingLocalIdsRef.current.add(id));
                    setNotebookPlaces(prev => {
                        const existingIds = new Set(prev.map(p => p.id));
                        return [...prev, ...previousPlaces.filter(p => !existingIds.has(p.id))];
                    });
                }
            }
        }
    };

    const inviteToNotebook = async (notebookId: string, email: string, role: string = 'editor'): Promise<{ success: boolean; error?: string }> => {
        try {
            if (!email || !email.includes('@')) {
                return { success: false, error: 'Email không hợp lệ.' };
            }
            if (!isRemoteMode || !supabase || !session) {
                return { success: false, error: 'Cần đăng nhập để mời thành viên.' };
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
        if (!isRemoteMode || !supabase || !session || !profile?.id) {
            return;
        }

        await acceptNotebookInvitationRemote(invitationId);
        await refreshContext();
    };

    const declineNotebookInvitation = async (invitationId: string) => {
        if (!isRemoteMode || !supabase) {
            return;
        }

        await runSupabaseMutation(() => supabase.from('notebook_invitations').update({
            status: 'declined',
        }).eq('id', invitationId));
        await refreshContext();
    };

    const deleteNotebook = async (id: string): Promise<{ success: boolean; error?: string }> => {
        const previousNotebooks = notebooks;
        const previousPlaces = notebookPlaces;
        try {
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
            if (!isMissingSupabaseObject(error)) {
                setNotebooks(previousNotebooks);
                setNotebookPlaces(previousPlaces);
            }
            return { success: false, error: error.message || 'Không thể xóa sổ tay.' };
        }
    };

    return (
        <NotebookContext.Provider value={{
            notebooks, addNotebook, deleteNotebook, notebookPlaces, addNotebookPlace,
            editNotebookPlace, deleteNotebookPlace, bulkDeleteNotebookPlaces,
            inviteToNotebook, pendingNotebookInvitations, acceptNotebookInvitation,
            declineNotebookInvitation, isSyncing
        }}>
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
