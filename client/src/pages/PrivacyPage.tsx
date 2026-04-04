import { useNavigate } from 'react-router-dom'

export function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen felt-table overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-8 text-white/80 font-body text-sm leading-relaxed">
        <button
          onClick={() => navigate(-1)}
          className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors"
        >
          ← Volver
        </button>

        <h1 className="font-header text-4xl text-gold mb-6">Política de Privacidad</h1>
        <p className="text-white/40 text-xs mb-8">Última actualización: 4 de abril de 2026</p>

        <section className="space-y-6">
          <div>
            <h2 className="font-header text-xl text-white mb-2">1. Información que Recopilamos</h2>
            <p>Al crear una cuenta en Dominó PR, recopilamos:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/60">
              <li><strong className="text-white/80">Nombre de usuario y contraseña</strong> — para autenticación</li>
              <li><strong className="text-white/80">Nombre para mostrar</strong> — visible a otros jugadores</li>
              <li><strong className="text-white/80">Correo electrónico</strong> — solo si usas Google Sign-In o Apple Sign-In</li>
              <li><strong className="text-white/80">Foto de perfil</strong> — solo si usas Google Sign-In</li>
              <li><strong className="text-white/80">Estadísticas de juego</strong> — partidas jugadas y ganadas</li>
            </ul>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">2. Cómo Usamos tu Información</h2>
            <p>Usamos tu información exclusivamente para:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/60">
              <li>Permitirte jugar dominó en línea con otros jugadores</li>
              <li>Mostrar tu nombre y avatar a otros jugadores en la sala</li>
              <li>Gestionar tu lista de amigos y solicitudes</li>
              <li>Mantener estadísticas de juego</li>
            </ul>
            <p className="mt-2">No vendemos, alquilamos ni compartimos tu información personal con terceros.</p>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">3. Almacenamiento y Seguridad</h2>
            <p>Tu información se almacena en servidores seguros (Railway + Supabase PostgreSQL). Las contraseñas se cifran con bcrypt y nunca se almacenan en texto plano. Las sesiones usan tokens JWT con expiración de 7 días.</p>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">4. Retención de Datos</h2>
            <p>Mantenemos tu cuenta y datos mientras la uses. Las sesiones inactivas expiran automáticamente después de 7 días. Puedes solicitar la eliminación de tu cuenta contactándonos.</p>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">5. Tus Derechos</h2>
            <p>Tienes derecho a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/60">
              <li>Acceder a tu información personal</li>
              <li>Modificar tu nombre para mostrar</li>
              <li>Solicitar la eliminación de tu cuenta y datos</li>
              <li>Cerrar sesión en cualquier momento</li>
            </ul>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">6. Menores de Edad</h2>
            <p>Dominó PR no está dirigido a menores de 13 años. No recopilamos intencionalmente información de niños menores de 13 años. Si crees que un menor ha proporcionado información personal, contáctanos para eliminarla.</p>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">7. Servicios de Terceros</h2>
            <p>Utilizamos los siguientes servicios de terceros:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/60">
              <li><strong className="text-white/80">Google Sign-In</strong> — autenticación (sujeto a la política de privacidad de Google)</li>
              <li><strong className="text-white/80">Railway</strong> — alojamiento del servidor</li>
              <li><strong className="text-white/80">Supabase</strong> — base de datos</li>
            </ul>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">8. Contacto</h2>
            <p>Para preguntas sobre esta política o para solicitar la eliminación de tus datos, contáctanos en: <span className="text-primary">dominopr.app@gmail.com</span></p>
          </div>
        </section>
      </div>
    </div>
  )
}
