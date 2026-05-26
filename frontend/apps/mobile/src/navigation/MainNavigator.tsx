import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '../screens/HomeScreen';
import { MapScreen } from '../screens/MapScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ProfileEditScreen } from '../screens/profile/ProfileEditScreen';
import { ProfileChangePasswordScreen } from '../screens/profile/ProfileChangePasswordScreen';
import { ProfileInterestsScreen } from '../screens/profile/ProfileInterestsScreen';
import { ProfileNotificationsScreen } from '../screens/profile/ProfileNotificationsScreen';
import { ProfileLanguageScreen } from '../screens/profile/ProfileLanguageScreen';
import { ProfileFavouritesScreen } from '../screens/profile/ProfileFavouritesScreen';
import { ProfileReviewsScreen } from '../screens/profile/ProfileReviewsScreen';
import { ProfileReservationsScreen } from '../screens/profile/ProfileReservationsScreen';
import { ProfilePaymentsScreen } from '../screens/profile/ProfilePaymentsScreen';
import { RoutesScreen } from '../screens/RoutesScreen';
import { ToursScreen } from '../screens/ToursScreen';
import { TourDetailScreen } from '../screens/tours/TourDetailScreen';
import { TourBookingScreen } from '../screens/tours/TourBookingScreen';
import { TourDeferredScreen } from '../screens/tours/TourDeferredScreen';
import { TourReviewsScreen } from '../screens/tours/TourReviewsScreen';
import { GuideProfileScreen } from '../screens/tours/GuideProfileScreen';
import { BookingDetailScreen } from '../screens/tours/BookingDetailScreen';
import { BookingPaymentErrorScreen } from '../screens/tours/BookingPaymentErrorScreen';
import { BookingPaymentSuccessScreen } from '../screens/tours/BookingPaymentSuccessScreen';
import { TourPaymentScreen } from '../screens/tours/TourPaymentScreen';
import { TourFiltersScreen } from '../screens/tours/TourFiltersScreen';
import { MapFiltersScreen } from '../screens/map/MapFiltersScreen';
import { PoeDetailScreen } from '../screens/map/PoeDetailScreen';
import { ActiveRouteScreen } from '../screens/routes/ActiveRouteScreen';
import {
  GuideBookingsDetailScreen,
  GuideCreateTourScreen,
  GuideDashboardScreen,
  GuideEditProfileScreen,
  GuideTourManageScreen,
} from '../screens/guide/GuideDashboardScreen';
import { GuideReviewsScreen } from '../screens/guide/GuideReviewsScreen';
import { GuideToursArchiveScreen } from '../screens/guide/GuideToursArchiveScreen';
import { useT } from '../shared/i18n/useT';
import { colors } from '../shared/theme/colors';

export type MainTabParamList = {
  Map: undefined;
  Routes: undefined;
  Home: undefined;
  Tours: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  MapFilters: undefined;
  TourFilters: undefined;
  PoeDetail: { poeId: string };
  TourDetail: { tourId: string; bookingId?: string };
  TourBooking: { tourId: string };
  TourDeferred: { tourId: string; bookingId?: string };
  TourReviews: { tourId: string };
  GuideProfile: { guideId: string; tourId?: string };
  BookingDetail: { bookingId: string };
  TourPayment: { bookingId: string };
  BookingPaymentSuccess: { bookingId: string };
  BookingPaymentError: { bookingId: string; errorMessage?: string };
  ActiveRoute: undefined;
  ProfileEdit: undefined;
  ProfileChangePassword: undefined;
  ProfileInterests: undefined;
  ProfileNotifications: undefined;
  ProfileLanguage: undefined;
  ProfileFavourites: undefined;
  ProfileReviews: undefined;
  ProfileReservations: undefined;
  ProfilePayments: undefined;
  GuideDashboard: undefined;
  GuideCreateTour: undefined;
  GuideEditProfile: undefined;
  GuideTourManage: { tourId: string };
  GuideBookingsDetail: { tourId: string };
  GuideReviews: undefined;
  GuideToursArchive: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

function TabsNavigator() {
  const { t } = useT();
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: colors.textPrimary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          height: 74,
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          paddingBottom: 7,
          paddingTop: 7,
        },
        tabBarActiveBackgroundColor: colors.accentButton,
        tabBarItemStyle: {
          borderRadius: 0,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const iconMap: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
            Map: 'map-outline',
            Routes: 'options-outline',
            Home: 'home-outline',
            Tours: 'ribbon-outline',
            Profile: 'person-outline',
          };
          return <Ionicons name={iconMap[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} options={{ title: t('tabs.map') }} />
      <Tab.Screen name="Routes" component={RoutesScreen} options={{ title: t('tabs.routes') }} />
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('tabs.home') }} />
      <Tab.Screen name="Tours" component={ToursScreen} options={{ title: t('tabs.tours') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tabs.profile') }} />
    </Tab.Navigator>
  );
}

export function MainNavigator({ route }: { route?: { params?: { startInGuide?: boolean } } }) {
  const startInGuide = Boolean(route?.params?.startInGuide);
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={startInGuide ? 'GuideDashboard' : 'Tabs'}
    >
      <Stack.Screen name="Tabs" component={TabsNavigator} />
      <Stack.Screen name="GuideDashboard" component={GuideDashboardScreen} />
      <Stack.Screen name="GuideCreateTour" component={GuideCreateTourScreen} />
      <Stack.Screen name="GuideEditProfile" component={GuideEditProfileScreen} />
      <Stack.Screen name="GuideTourManage" component={GuideTourManageScreen} />
      <Stack.Screen name="GuideBookingsDetail" component={GuideBookingsDetailScreen} />
      <Stack.Screen name="GuideReviews" component={GuideReviewsScreen} />
      <Stack.Screen name="GuideToursArchive" component={GuideToursArchiveScreen} />
      <Stack.Screen
        name="MapFilters"
        component={MapFiltersScreen}
        options={{
          headerShown: true,
          title: 'Назад',
          headerTintColor: colors.textPrimary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="TourFilters"
        component={TourFiltersScreen}
        options={{
          headerShown: true,
          title: 'Назад',
          headerTintColor: colors.textPrimary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen name="PoeDetail" component={PoeDetailScreen} />
      <Stack.Screen name="TourDetail" component={TourDetailScreen} />
      <Stack.Screen name="TourBooking" component={TourBookingScreen} />
      <Stack.Screen name="TourDeferred" component={TourDeferredScreen} />
      <Stack.Screen name="TourReviews" component={TourReviewsScreen} />
      <Stack.Screen name="GuideProfile" component={GuideProfileScreen} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
      <Stack.Screen name="TourPayment" component={TourPaymentScreen} />
      <Stack.Screen name="BookingPaymentSuccess" component={BookingPaymentSuccessScreen} />
      <Stack.Screen name="BookingPaymentError" component={BookingPaymentErrorScreen} />
      <Stack.Screen name="ActiveRoute" component={ActiveRouteScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <Stack.Screen
        name="ProfileChangePassword"
        component={ProfileChangePasswordScreen}
      />
      <Stack.Screen name="ProfileInterests" component={ProfileInterestsScreen} />
      <Stack.Screen
        name="ProfileNotifications"
        component={ProfileNotificationsScreen}
      />
      <Stack.Screen name="ProfileLanguage" component={ProfileLanguageScreen} />
      <Stack.Screen name="ProfileFavourites" component={ProfileFavouritesScreen} />
      <Stack.Screen name="ProfileReviews" component={ProfileReviewsScreen} />
      <Stack.Screen
        name="ProfileReservations"
        component={ProfileReservationsScreen}
      />
      <Stack.Screen name="ProfilePayments" component={ProfilePaymentsScreen} />
    </Stack.Navigator>
  );
}
