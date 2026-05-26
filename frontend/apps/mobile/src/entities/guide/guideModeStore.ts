import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  DEFAULT_ACCESSIBILITY_WHEN_EMPTY,
  hasAccessibilitySelection,
  WIDE_PASSAGES_TAG,
} from '../tour/accessibility';

export type GuideApplicationStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type GuideApplicationPayload = {
  displayName: string;
  bio: string;
  specializations: string[];
  languages: string[];
  experienceYears: number;
  contacts: string;
};

export type LocalGuideTour = {
  id: string;
  title: string;
  description: string;
  price: number;
  paymentMode: 'now' | 'before_start' | 'on_meeting';
  paymentDeadlineHours: number;
  groupType: 'group' | 'individual';
  maxPeople: number;
  durationHours: number;
  meetingPoint: string;
  accessibility: {
    ramp: boolean;
    widePassages: boolean;
    stairs: boolean;
  };
  image: string;
  scheduleLabel: string;
  slotStartsAt: string | null;
  status: 'published' | 'archived';
  createdAt: string;
};

export type LocalGuideBooking = {
  id: string;
  tourId: string;
  customerName: string;
  participantsCount: number;
  contact: string;
  comment: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
};

type GuideModeState = {
  _hasHydrated: boolean;
  applicationStatus: GuideApplicationStatus;
  hasEnteredGuideMode: boolean;
  application: GuideApplicationPayload | null;
  rejectionReason: string | null;
  tours: LocalGuideTour[];
  bookings: LocalGuideBooking[];
  submitApplication: (payload: GuideApplicationPayload) => void;
  syncApplicationFromServer: (
    status: Exclude<GuideApplicationStatus, 'none'>,
    payload: GuideApplicationPayload,
    rejectionReason?: string | null,
  ) => void;
  updateApplication: (payload: GuideApplicationPayload) => void;
  revokeApplication: () => void;
  approveApplication: () => void;
  rejectApplication: (reason?: string) => void;
  enterGuideMode: () => void;
  exitGuideMode: () => void;
  addTour: (payload: Omit<LocalGuideTour, 'id' | 'createdAt' | 'status'>) => LocalGuideTour;
  updateTour: (id: string, patch: Partial<LocalGuideTour>) => void;
  archiveTour: (id: string) => void;
  addBooking: (payload: Omit<LocalGuideBooking, 'id' | 'createdAt' | 'status'>) => LocalGuideBooking;
  setHydrated: (value: boolean) => void;
};

const REMOVED_DEMO_TOUR_IDS = new Set([
  'local-tour-sketching-old-city',
  'local-tour-lavrovsky-theatre',
]);

export const useGuideModeStore = create<GuideModeState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      applicationStatus: 'none',
      hasEnteredGuideMode: false,
      application: null,
      rejectionReason: null,
      tours: [],
      bookings: [],
      submitApplication: (payload) =>
        set({
          applicationStatus: 'pending',
          hasEnteredGuideMode: false,
          application: payload,
          rejectionReason: null,
        }),
      syncApplicationFromServer: (status, payload, rejectionReason) =>
        set({
          applicationStatus: status,
          application: payload,
          rejectionReason: rejectionReason ?? null,
        }),
      updateApplication: (payload) =>
        set({
          application: payload,
          rejectionReason: null,
        }),
      revokeApplication: () =>
        set({
          applicationStatus: 'none',
          hasEnteredGuideMode: false,
          application: null,
          rejectionReason: null,
        }),
      approveApplication: () =>
        set({
          applicationStatus: 'approved',
          hasEnteredGuideMode: false,
          rejectionReason: null,
        }),
      rejectApplication: (reason) =>
        set({
          applicationStatus: 'rejected',
          hasEnteredGuideMode: false,
          rejectionReason: reason ?? 'недостаточно данных об опыте работы.',
        }),
      enterGuideMode: () => set({ hasEnteredGuideMode: true }),
      exitGuideMode: () => set({ hasEnteredGuideMode: false }),
      addTour: (payload) => {
        const tour: LocalGuideTour = {
          ...payload,
          id: `local-tour-${Date.now()}`,
          createdAt: new Date().toISOString(),
          status: 'published',
        };
        set({ tours: [tour, ...get().tours] });
        return tour;
      },
      updateTour: (id, patch) =>
        set((state) => ({
          tours: state.tours.map((tour) =>
            tour.id === id ? { ...tour, ...patch } : tour,
          ),
        })),
      archiveTour: (id) =>
        set((state) => ({
          tours: state.tours.map((tour) =>
            tour.id === id ? { ...tour, status: 'archived' } : tour,
          ),
        })),
      addBooking: (payload) => {
        const booking: LocalGuideBooking = {
          ...payload,
          id: `local-booking-${Date.now()}`,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ bookings: [booking, ...state.bookings] }));
        return booking;
      },
      setHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: 'guide-mode',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({
        applicationStatus: state.applicationStatus,
        hasEnteredGuideMode: state.hasEnteredGuideMode,
        application: state.application,
        rejectionReason: state.rejectionReason,
        tours: state.tours,
        bookings: state.bookings,
      }),
      migrate: (persistedState) => {
        const state = persistedState as Partial<GuideModeState>;
        return {
          ...state,
          tours:
            state.tours
              ?.filter((tour) => !REMOVED_DEMO_TOUR_IDS.has(tour.id))
              .map((tour) => ({
                ...tour,
                slotStartsAt: tour.slotStartsAt ?? null,
              })) ?? [],
          bookings:
            state.bookings?.filter((booking) => !REMOVED_DEMO_TOUR_IDS.has(booking.tourId)) ?? [],
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export function hasLocalGuideAccess() {
  const { applicationStatus, hasEnteredGuideMode } = useGuideModeStore.getState();
  return applicationStatus === 'approved' || hasEnteredGuideMode;
}

export function localTourToPublic(tour: LocalGuideTour, guideName: string) {
  return {
    id: tour.id,
    title: tour.title,
    short_description: tour.description,
    city_id: 'ekb',
    format: 'offline_guided',
    language: 'ru',
    duration_minutes: tour.durationHours * 60,
    group_size_max: tour.maxPeople,
    status: tour.status === 'published' ? 'published' : 'hidden',
    price: { amount: tour.price, currency: 'RUB' },
    guide: {
      id: 'local-guide',
      name: guideName,
      rating: 0,
      reviews_count: 0,
    },
    rating: 0,
    reviews_count: 0,
    cover_image_url: tour.image,
    accessibility: hasAccessibilitySelection(tour.accessibility)
      ? {
          wheelchair_accessible: tour.accessibility.ramp,
          avoid_stairs_possible: !tour.accessibility.stairs,
        }
      : { ...DEFAULT_ACCESSIBILITY_WHEN_EMPTY },
  };
}

export function localTourToDetail(tour: LocalGuideTour, guideName: string) {
  return {
    ...localTourToPublic(tour, guideName),
    description: tour.description,
    guide: {
      id: 'local-guide',
      name: guideName,
      rating: 0,
      reviews_count: 0,
      avatar_url: null,
      bio: 'Люблю свой город и знаю о нем почти все. Проведу по тайным дворикам и местам, которые обычно не попадают в стандартные маршруты.',
    },
    group_size_max: tour.maxPeople,
    tags: [
      'art',
      'walk',
      ...(tour.accessibility.widePassages ? [WIDE_PASSAGES_TAG] : []),
    ],
    meeting_point: {
      lat: 56.8076,
      lng: 60.5971,
      address: tour.meetingPoint,
    },
    route_preview: {
      distance_meters: 3200,
      points_count: 4,
    },
    images: [tour.image],
    cancellation_policy: tour.paymentMode,
  };
}
