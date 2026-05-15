import Image from 'next/image';

/**
 * Logo animada usada como indicador de carregamento global.
 * Fundo sempre transparente — não cobre o conteúdo atrás.
 *
 * @param size       - Tamanho da imagem em pixels (default: 160)
 * @param fullscreen - Se true, centraliza com position absolute cobrindo o container pai
 */
interface LoadingLogoProps {
  size?: number;
  fullscreen?: boolean;
}

export default function LoadingLogo({ size = 160, fullscreen = true }: LoadingLogoProps) {
  const logo = (
    <Image
      src="/logo-infinity.png"
      alt="Carregando..."
      width={size}
      height={size}
      className="animate-pulse drop-shadow-[0_0_28px_rgba(239,68,68,0.7)]"
      priority
    />
  );

  if (!fullscreen) return logo;

  return (
    <div className="flex justify-center items-center h-screen">
      {logo}
    </div>
  );
}
