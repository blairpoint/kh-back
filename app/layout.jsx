export const metadata = {
  title: 'Kohartist API',
  description: 'Backend API for Kohartist',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}