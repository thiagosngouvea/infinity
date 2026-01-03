'use client';

import { useState, useEffect } from 'react';
import { Trophy, Sparkles } from 'lucide-react';
import Confetti from 'react-confetti';

interface RaffleWheelProps {
  isOpen: boolean;
  participants: string[]; // IDs dos participantes
  participantNames: { [key: string]: string }; // Map de ID -> Nome
  onComplete: (winnerId: string) => void;
  prize: string;
}

export default function RaffleWheel({
  isOpen,
  participants,
  participantNames,
  onComplete,
  prize
}: RaffleWheelProps) {
  const [spinning, setSpinning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speed, setSpeed] = useState(50);
  const [winner, setWinner] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Configurar tamanho da janela para confetes
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight
    });

    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen && !spinning && participants.length > 0) {
      startSpin();
    }
  }, [isOpen]);

  const startSpin = () => {
    setSpinning(true);
    setWinner(null);
    
    // Escolher vencedor antecipadamente
    const winnerIndex = Math.floor(Math.random() * participants.length);
    const totalSpins = 20 + Math.floor(Math.random() * 10); // 20-30 voltas
    let spinCount = 0;
    let currentSpeed = 50;

    const spinInterval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % participants.length);
      spinCount++;

      // Desacelerar gradualmente
      if (spinCount > totalSpins * participants.length * 0.7) {
        currentSpeed += 20; // Desacelera mais rápido no final
      } else if (spinCount > totalSpins * participants.length * 0.5) {
        currentSpeed += 10;
      }

      setSpeed(currentSpeed);

      // Parar no vencedor
      if (spinCount >= totalSpins * participants.length) {
        clearInterval(spinInterval);
        
        // Ajustar para parar exatamente no vencedor
        setTimeout(() => {
          setCurrentIndex(winnerIndex);
          setWinner(participants[winnerIndex]);
          setSpinning(false);
          setShowConfetti(true);
          
          // Vibração (se disponível)
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }

          // Chamar callback após animação completa
          setTimeout(() => {
            onComplete(participants[winnerIndex]);
          }, 4000); // 4 segundos para aproveitar a vitória
        }, currentSpeed);
      }
    }, currentSpeed);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Confetes */}
      {showConfetti && windowSize.width > 0 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border-2 border-purple-500 max-w-2xl w-full p-8">
          
          {/* Título */}
          <div className="text-center mb-8">
            <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-3xl font-bold text-white mb-2">
              {spinning ? '🎲 Sorteando...' : winner ? '🎉 Parabéns!' : 'Sorteio'}
            </h2>
            <p className="text-gray-400">Prêmio: {prize}</p>
          </div>

          {/* Roleta */}
          <div className="relative mb-8">
            {/* Container da roleta */}
            <div className="bg-gray-800 rounded-xl border-4 border-purple-600 p-8 relative overflow-hidden">
              {/* Indicador central */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[30px] border-t-purple-500" />
              </div>

              {/* Display do nome atual */}
              <div className="text-center py-12">
                <div className={`text-4xl font-bold transition-all duration-200 ${
                  spinning 
                    ? 'text-white scale-110' 
                    : winner 
                      ? 'text-yellow-400 scale-125 animate-pulse' 
                      : 'text-gray-400'
                }`}>
                  {participantNames[participants[currentIndex]] || 'Carregando...'}
                </div>
                
                {!spinning && winner && (
                  <div className="mt-6 flex justify-center gap-2">
                    <Sparkles className="h-8 w-8 text-yellow-400 animate-spin" />
                    <Sparkles className="h-8 w-8 text-yellow-400 animate-spin" style={{ animationDelay: '0.2s' }} />
                    <Sparkles className="h-8 w-8 text-yellow-400 animate-spin" style={{ animationDelay: '0.4s' }} />
                  </div>
                )}
              </div>

              {/* Efeito de brilho durante o giro */}
              {spinning && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent animate-shimmer" />
              )}
            </div>

            {/* Lista de participantes (visual) */}
            <div className="mt-4 flex justify-center gap-2 flex-wrap max-h-20 overflow-hidden">
              {participants.map((id, index) => (
                <div
                  key={id}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    index === currentIndex
                      ? 'bg-purple-600 text-white scale-110 font-bold'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {participantNames[id]}
                </div>
              ))}
            </div>
          </div>

          {/* Contador de participantes */}
          <div className="text-center text-gray-400 text-sm">
            {participants.length} participante(s) no sorteio
          </div>

          {/* Mensagem de vitória */}
          {winner && !spinning && (
            <div className="mt-6 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg p-6 text-center animate-scale-in">
              <p className="text-2xl font-bold text-white mb-2">
                🏆 {participantNames[winner]} Ganhou! 🏆
              </p>
              <p className="text-yellow-100">
                O vencedor receberá uma notificação em breve!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Estilos customizados */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes scale-in {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-shimmer {
          animation: shimmer 1s infinite;
        }

        .animate-scale-in {
          animation: scale-in 0.5s ease-out;
        }
      `}</style>
    </>
  );
}

