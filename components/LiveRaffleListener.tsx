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
          const membersSnap = await getDocs(query(
            clanCol(clan.slug, COLS.users),
            where('role', 'in', ['member', 'admin', 'super_admin']),
          ));
          membersSnap.docs.forEach((userDoc) => {
            names[userDoc.id] = userDoc.data()?.nick || 'Usuário';
          });

          // Mapear participantes fakes para testes locais
          const COOL_FAKE_NAMES = [
            'ShadowHunter', 'Phoenix_PW', 'ViperX', 'Titan_WB', 'GhostRider', 'BlazeMage', 'StormSacer', 'GoldHunter', 'RogueWarrior', 'Rex_MG',
            'SniperArqueiro', 'ZeusGod', 'OdinKing', 'ThorHammer', 'LokiTrick', 'AresWar', 'HadesUnder', 'AnubisGuard', 'RaSun', 'NeonKnight',
            'SpecterGhost', 'WraithMistico', 'ReaperDeath', 'DoomSlayer', 'AlphaLeader', 'OmegaEnd', 'KratosGodOfWar', 'GokuSSJ', 'VegetaPrince', 'LinkHero',
            'ZeldaPrincess', 'MarioPlumber', 'LuigiGreen', 'SonicSpeed', 'TailsFox', 'KnucklesRed', 'DanteDevil', 'VergilBlade', 'NeroArm', 'LeonSpecial',
            'ChrisRedfield', 'ClaireRed', 'JillValentine', 'AdaWong', 'WeskerUro', 'NemesisSTARS', 'CloudStrife', 'SephirothAngel', 'TifaLockhart', 'AerithFlower'
          ];

          raffle.participants.forEach((userId) => {
            if (userId.startsWith('fake_')) {
              const index = parseInt(userId.split('_')[1]) || 0;
              names[userId] = COOL_FAKE_NAMES[index] || `FakePlayer_${index}`;
            }
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
        const winnerIds = activeRaffle.winnerIds && activeRaffle.winnerIds.length > 0
          ? activeRaffle.winnerIds
          : (activeRaffle.winnerId ? [activeRaffle.winnerId] : [winnerId]);

        // Atualizar sorteio no Firestore
        await updateDoc(clanDoc(clan.slug, COLS.raffles, activeRaffle.id), {
          status: 'completed',
          drawDate: new Date()
        });

        // Criar notificação para todos os vencedores
        for (const wId of winnerIds) {
          const wName = participantNames[wId] || 'Usuário';
          await addDoc(clanCol(clan.slug, COLS.notifications), {
            userId: wId,
            type: 'raffle_win',
            title: 'Você Ganhou!',
            message: `Parabéns! Você ganhou o sorteio: ${activeRaffle.title} - ${activeRaffle.prize}`,
            read: false,
            createdAt: new Date()
          });
        }

        const winnersDisplay = winnerIds.map(wId => participantNames[wId] || 'Usuário').join(', ');
        toast.success(`Sorteio finalizado! Vencedor(es): ${winnersDisplay}`);
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
      winnerIds={activeRaffle.winnerIds}
    />
  );
}
