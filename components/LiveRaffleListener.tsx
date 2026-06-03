'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import { query, onSnapshot, where, getDocs, updateDoc, addDoc } from 'firebase/firestore';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import { Raffle } from '@/types';
import RaffleWheel from '@/components/RaffleWheel';
import toast from 'react-hot-toast';

export default function LiveRaffleListener() {
  const { userData } = useAuth();
  const { clan } = useClan();
  const [activeRaffle, setActiveRaffle] = useState<Raffle | null>(null);
  const [participantNames, setParticipantNames] = useState<{ [key: string]: string }>({});
  const [showWheel, setShowWheel] = useState(false);
  const [isProcessingResult, setIsProcessingResult] = useState(false);

  // Ref para evitar closures desatualizadas no onSnapshot
  const activeRaffleRef = useRef<Raffle | null>(null);

  useEffect(() => {
    if (!clan?.slug || !userData) {
      setActiveRaffle(null);
      setShowWheel(false);
      activeRaffleRef.current = null;
      return;
    }

    const q = query(
      clanCol(clan.slug, COLS.raffles),
      where('status', '==', 'drawing')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // Ignora se não houver sorteio em andamento, permitindo que roletas locais terminem
        return;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      const raffle = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        drawDate: data.drawDate?.toDate() || undefined,
        drawStartedAt: data.drawStartedAt?.toDate() || undefined,
      } as Raffle;

      // Se for um sorteio novo ou se não tiver nenhum rodando
      if (!activeRaffleRef.current || activeRaffleRef.current.id !== raffle.id) {
        // Verificar expiração (45 segundos) para evitar que usuários recém-conectados
        // vejam sorteios que já passaram ou que ficaram travados no Firestore
        if (raffle.drawStartedAt) {
          const elapsed = Date.now() - raffle.drawStartedAt.getTime();
          if (elapsed > 45000) {
            console.log('⚠️ Sorteio ignorado por estar travado/expirado (> 45s)');
            return;
          }
        }

        activeRaffleRef.current = raffle;
        setActiveRaffle(raffle);
        setIsProcessingResult(false);

        try {
          // Carregar nomes de todos os usuários para mapeamento ID -> Nick
          const names: { [key: string]: string } = {};
          const membersSnap = await getDocs(clanCol(clan.slug, COLS.users));
          membersSnap.docs.forEach((userDoc) => {
            names[userDoc.id] = userDoc.data()?.nick || 'Usuário';
          });
          setParticipantNames(names);
          setShowWheel(true);
        } catch (error) {
          console.error('Erro ao carregar nomes dos membros para sorteio ao vivo:', error);
        }
      }
    }, (error) => {
      console.error('Erro no listener de sorteios ao vivo:', error);
    });

    return () => unsubscribe();
  }, [clan?.slug, userData]);

  const handleWheelComplete = async (winnerId: string) => {
    if (isProcessingResult) return;
    if (!activeRaffle) return;

    setIsProcessingResult(true);

    // APENAS o admin que iniciou o sorteio deve persistir o status como concluído
    if (userData && activeRaffle.drawnBy === userData.id) {
      try {
        const winnerName = participantNames[winnerId] || 'Usuário';

        // Atualizar sorteio no Firestore
        await updateDoc(clanDoc(clan.slug, COLS.raffles, activeRaffle.id), {
          winnerId,
          winnerName,
          status: 'completed',
          drawDate: new Date()
        });

        // Criar notificação para o vencedor
        await addDoc(clanCol(clan.slug, COLS.notifications), {
          userId: winnerId,
          type: 'raffle_win',
          title: 'Você Ganhou!',
          message: `Parabéns! Você ganhou o sorteio: ${activeRaffle.title} - ${activeRaffle.prize}`,
          read: false,
          createdAt: new Date()
        });

        toast.success(`Sorteio finalizado! Vencedor: ${winnerName}`);
      } catch (error) {
        console.error('Erro ao salvar resultado final do sorteio:', error);
        toast.error('Erro ao salvar resultado final do sorteio');
      }
    }

    // Fechar a modal e resetar estados locais após 1.5s da finalização da animação
    setTimeout(() => {
      setShowWheel(false);
      setActiveRaffle(null);
      activeRaffleRef.current = null;
      setIsProcessingResult(false);
    }, 1500);
  };

  if (!showWheel || !activeRaffle) return null;

  return (
    <RaffleWheel
      isOpen={showWheel}
      participants={activeRaffle.participants}
      participantNames={participantNames}
      onComplete={handleWheelComplete}
      prize={activeRaffle.prize}
      winnerId={activeRaffle.winnerId}
    />
  );
}
