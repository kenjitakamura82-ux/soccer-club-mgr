import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import '../index.css'
import LiffApp from './LiffApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* iPhoneの「視差効果を減らす」がオンなら動きを止める */}
    <MotionConfig reducedMotion="user">
      <LiffApp />
    </MotionConfig>
  </StrictMode>,
)
