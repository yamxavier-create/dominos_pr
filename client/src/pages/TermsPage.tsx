import { useNavigate } from 'react-router-dom'

export function TermsPage() {
  const navigate = useNavigate()

  return (
    <div className="fixed inset-0 felt-table overflow-y-auto z-50">
      <div className="max-w-2xl mx-auto px-5 py-8 text-white/80 font-body text-sm leading-relaxed" style={{ paddingTop: 'max(32px, env(safe-area-inset-top))' }}>
        <button
          onClick={() => navigate(-1)}
          className="text-white/40 hover:text-white/70 text-sm mb-6 transition-colors"
        >
          ← Volver
        </button>

        <h1 className="font-header text-4xl text-gold mb-6">Términos de Servicio</h1>
        <p className="text-white/40 text-xs mb-8">Última actualización: 4 de abril de 2026</p>

        <section className="space-y-6">
          <div>
            <h2 className="font-header text-xl text-white mb-2">1. Aceptación de los Términos</h2>
            <p>Al usar Dominó PR, aceptas estos términos de servicio. Si no estás de acuerdo, no utilices la aplicación.</p>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">2. Descripción del Servicio</h2>
            <p>Dominó PR es un juego de dominó puertorriqueño en línea para 2 o 4 jugadores. El servicio incluye:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/60">
              <li>Juego de dominó doble seis en tiempo real</li>
              <li>Modos de juego: Modo 200 y Modo 500</li>
              <li>Chat de texto y videollamada durante partidas</li>
              <li>Sistema de amigos e invitaciones</li>
            </ul>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">3. Cuentas de Usuario</h2>
            <p>Puedes jugar como invitado o crear una cuenta. Al crear una cuenta:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/60">
              <li>Eres responsable de mantener la seguridad de tu contraseña</li>
              <li>Tu nombre de usuario debe ser apropiado y no ofensivo</li>
              <li>No debes crear múltiples cuentas para evadir restricciones</li>
            </ul>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">4. Conducta del Usuario</h2>
            <p>Al usar Dominó PR, te comprometes a no:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-white/60">
              <li>Usar lenguaje ofensivo, acosador o discriminatorio en el chat</li>
              <li>Intentar manipular o hacer trampa en las partidas</li>
              <li>Interferir con el funcionamiento del servicio</li>
              <li>Usar bots o software automatizado para jugar</li>
            </ul>
            <p className="mt-2">Nos reservamos el derecho de suspender cuentas que violen estas reglas.</p>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">5. Propiedad Intelectual</h2>
            <p>El código, diseño, gráficos y contenido de Dominó PR son propiedad de sus creadores. El juego de dominó en sí es un juego tradicional de dominio público.</p>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">6. Disponibilidad del Servicio</h2>
            <p>Dominó PR se ofrece "tal cual". No garantizamos disponibilidad continua e ininterrumpida. Podemos modificar, suspender o descontinuar el servicio en cualquier momento.</p>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">7. Limitación de Responsabilidad</h2>
            <p>Dominó PR no se hace responsable por pérdidas de datos, interrupciones del servicio, o cualquier daño directo o indirecto derivado del uso de la aplicación.</p>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">8. Cambios a los Términos</h2>
            <p>Podemos actualizar estos términos en cualquier momento. El uso continuado del servicio después de cambios constituye aceptación de los nuevos términos.</p>
          </div>

          <div>
            <h2 className="font-header text-xl text-white mb-2">9. Contacto</h2>
            <p>Para preguntas sobre estos términos, contáctanos en: <span className="text-primary">dominopr.app@gmail.com</span></p>
          </div>
        </section>
      </div>
    </div>
  )
}
