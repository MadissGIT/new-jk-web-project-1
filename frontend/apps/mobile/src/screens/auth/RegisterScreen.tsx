import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuthStore } from '../../entities/auth/authStore';
import { useProfileExtrasStore } from '../../entities/profile/profileExtrasStore';
import { AuthPrimaryButton } from '../../features/auth/components/AuthPrimaryButton';
import { LogoMark } from '../../features/auth/components/LogoMark';
import {
  type RegisterFormValues,
  registerSchema,
  splitFullName,
} from '../../features/auth/schemas/registerSchema';
import { UnderlineField } from '../../features/auth/components/UnderlineField';
import { extractApiError } from '../../shared/api/http';
import { useLogin, useRegister } from '../../shared/auth/hooks';
import { colors } from '../../shared/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

// Заглушка, пока на бэке date_of_birth обязателен. Когда поле сделают nullable,
// убрать и не передавать его в payload.
const DATE_OF_BIRTH_FALLBACK = '2000-01-01';

function translateRegisterError(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return 'Нет соединения с сервером. Проверьте интернет.';
    }
    if (error.response.status === 409) {
      return 'Пользователь с таким email уже существует';
    }
    if (error.response.status === 503) {
      return extractApiError(error);
    }
    if (error.response.status >= 500) {
      return 'Сервер временно недоступен. Попробуйте позже.';
    }
  }
  return extractApiError(error);
}

export function RegisterScreen({ navigation }: Props) {
  const register = useRegister();
  const login = useLogin();
  const submitting = register.isPending || login.isPending;
  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit, setError, clearErrors, formState } =
    useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const fullNameValue = useWatch({ control, name: 'fullName' });
  const phoneValue = useWatch({ control, name: 'phone' });
  const emailValue = useWatch({ control, name: 'email' });
  const passwordValue = useWatch({ control, name: 'password' });
  const confirmPasswordValue = useWatch({ control, name: 'confirmPassword' });

  useEffect(() => {
    if (formError) {
      setFormError(null);
      clearErrors(['fullName', 'phone', 'email', 'password', 'confirmPassword']);
    }
  }, [
    fullNameValue,
    phoneValue,
    emailValue,
    passwordValue,
    confirmPasswordValue,
    formError,
    clearErrors,
  ]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const email = values.email.trim();
    const password = values.password;
    const { surname, name } = splitFullName(values.fullName);

    try {
      await register.mutateAsync({
        name,
        surname,
        patronymic: null,
        phone: values.phone.trim() || null,
        email,
        password,
        date_of_birth: DATE_OF_BIRTH_FALLBACK,
      });
      await login.mutateAsync({ email, password });
      const uid = useAuthStore.getState().user?.id;
      const phoneTrimmed = values.phone.trim();
      if (uid) {
        useProfileExtrasStore.getState().setPhoneForUser(uid, phoneTrimmed || null);
      }
      navigation.reset({ index: 0, routes: [{ name: 'OnboardingInterests' }] });
    } catch (error) {
      const message = translateRegisterError(error);
      setFormError(message);
      setError('email', { type: 'server' });
      setError('password', { type: 'server' });
      setError('confirmPassword', { type: 'server' });
    }
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <LogoMark size={52} />
          <Text style={styles.title}>Добро пожаловать!</Text>
        </View>

        <UnderlineField control={control} name="fullName" label="Фамилия и имя" />
        <UnderlineField
          control={control}
          name="phone"
          label="Телефон"
          keyboardType="phone-pad"
          autoCapitalize="none"
        />
        <UnderlineField
          control={control}
          name="email"
          label="Email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <UnderlineField
          control={control}
          name="password"
          label="Пароль"
          secureTextEntry
          autoCapitalize="none"
        />
        <UnderlineField
          control={control}
          name="confirmPassword"
          label="Повторите пароль"
          secureTextEntry
          autoCapitalize="none"
        />

        {formError ? (
          <View style={styles.errorBox}>
            <Feather
              name="alert-circle"
              size={16}
              color={colors.errorText}
              style={styles.errorIcon}
            />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        <AuthPrimaryButton
          title="Зарегистрироваться"
          onPress={onSubmit}
          loading={submitting}
          disabled={!formState.isValid}
        />

        <Text style={styles.footer}>
          Уже есть аккаунт?{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
            Войти
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
  },
  scroll: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 40,
  },
  top: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  footer: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textMuted,
  },
  errorBox: {
    marginTop: 10,
    backgroundColor: colors.errorBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorIcon: {
    marginTop: 1,
  },
  errorText: {
    flex: 1,
    color: colors.errorText,
    fontSize: 13,
    lineHeight: 18,
  },
  link: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
