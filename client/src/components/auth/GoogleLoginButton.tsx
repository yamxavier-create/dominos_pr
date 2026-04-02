import { GoogleLogin, CredentialResponse } from '@react-oauth/google'

interface GoogleLoginButtonProps {
  onGoogleLogin: (idToken: string) => Promise<void>
}

export function GoogleLoginButton({ onGoogleLogin }: GoogleLoginButtonProps) {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  if (!googleClientId) return null

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      await onGoogleLogin(credentialResponse.credential)
    }
  }

  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => console.error('[Auth] Google login failed')}
        theme="filled_black"
        size="large"
        text="continue_with"
        width={320}
      />
    </div>
  )
}
