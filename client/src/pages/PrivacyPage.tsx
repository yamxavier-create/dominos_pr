import { useNavigate } from 'react-router-dom'
import { StageBackdrop } from '../components/ui/Escenario'

export function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="fixed inset-0 felt-table overflow-y-auto z-50">
      <StageBackdrop still />
      <div className="relative max-w-2xl mx-auto px-4 py-8 text-white/85 font-body text-sm leading-relaxed" style={{ paddingTop: 'max(32px, env(safe-area-inset-top))' }}>
        <button
          onClick={() => navigate(-1)}
          className="btn-outline-shine rounded-xl px-3 py-1.5 mb-6 font-chunky text-base tracking-wide mm-stroke"
        >
          ‹ Volver
        </button>

        <div className="mm-panel px-5 py-6 sm:px-7">
        <h1 className="mm-title text-[2rem] leading-tight mb-2">Política de Privacidad</h1>
        <p className="font-bold text-white/60 text-xs mb-7">Última actualización: 4 de abril de 2026</p>

        <section className="space-y-6">
          <div>
            <h2 className="mm-title text-xl leading-tight mb-2">1. Información que Recopilamos</h2>
            <p>Al crear una cuenta en Dominó PR, recopilamos:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/75">
              <li><strong className="text-white font-extrabold">Nombre de usuario y contraseña</strong> — para autenticación</li>
              <li><strong className="text-white font-extrabold">Nombre para mostrar</strong> — visible a otros jugadores</li>
              <li><strong className="text-white font-extrabold">Correo electrónico</strong> — solo si usas Google Sign-In o Apple Sign-In</li>
              <li><strong className="text-white font-extrabold">Foto de perfil</strong> — solo si usas Google Sign-In</li>
              <li><strong className="text-white font-extrabold">Estadísticas de juego</strong> — partidas jugadas y ganadas</li>
            </ul>
          </div>

          <div>
            <h2 className="mm-title text-xl leading-tight mb-2">2. Cómo Usamos tu Información</h2>
            <p>Usamos tu información exclusivamente para:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/75">
              <li>Permitirte jugar dominó en línea con otros jugadores</li>
              <li>Mostrar tu nombre y avatar a otros jugadores en la sala</li>
              <li>Gestionar tu lista de amigos y solicitudes</li>
              <li>Mantener estadísticas de juego</li>
            </ul>
            <p className="mt-2">No vendemos, alquilamos ni compartimos tu información personal con terceros.</p>
          </div>

          <div>
            <h2 className="mm-title text-xl leading-tight mb-2">3. Almacenamiento y Seguridad</h2>
            <p>Tu información se almacena en servidores seguros (Railway + Supabase PostgreSQL). Las contraseñas se cifran con bcrypt y nunca se almacenan en texto plano. Las sesiones usan tokens JWT con expiración de 7 días.</p>
          </div>

          <div>
            <h2 className="mm-title text-xl leading-tight mb-2">4. Retención de Datos</h2>
            <p>Mantenemos tu cuenta y datos mientras la uses. Las sesiones inactivas expiran automáticamente después de 7 días. Puedes solicitar la eliminación de tu cuenta contactándonos.</p>
          </div>

          <div>
            <h2 className="mm-title text-xl leading-tight mb-2">5. Tus Derechos</h2>
            <p>Tienes derecho a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/75">
              <li>Acceder a tu información personal</li>
              <li>Modificar tu nombre para mostrar</li>
              <li>Solicitar la eliminación de tu cuenta y datos</li>
              <li>Cerrar sesión en cualquier momento</li>
            </ul>
          </div>

          <div>
            <h2 className="mm-title text-xl leading-tight mb-2">6. Menores de Edad</h2>
            <p>Dominó PR no está dirigido a menores de 13 años. No recopilamos intencionalmente información de niños menores de 13 años. Si crees que un menor ha proporcionado información personal, contáctanos para eliminarla.</p>
          </div>

          <div>
            <h2 className="mm-title text-xl leading-tight mb-2">7. Servicios de Terceros</h2>
            <p>Utilizamos los siguientes servicios de terceros:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/75">
              <li><strong className="text-white font-extrabold">Google Sign-In</strong> — autenticación (sujeto a la política de privacidad de Google)</li>
              <li><strong className="text-white font-extrabold">Railway</strong> — alojamiento del servidor</li>
              <li><strong className="text-white font-extrabold">Supabase</strong> — base de datos</li>
            </ul>
          </div>

          <div>
            <h2 className="mm-title text-xl leading-tight mb-2">8. Contacto</h2>
            <p>Para preguntas sobre esta política o para solicitar la eliminación de tus datos, contáctanos en: <span className="font-extrabold text-[#FDD04B]">dominopr.app@gmail.com</span></p>
          </div>
        </section>
        </div>
      </div>
    </div>
  )
}
