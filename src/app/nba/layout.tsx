// NBA Layout - Shared layout for all NBA pages

export default function NBALayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="sport-nba">
      {children}
    </div>
  );
}





