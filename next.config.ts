/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Для GitHub Pages вам нужно указать basePath, если размещаете не в корневом домене
  basePath: '/vibeTV', // Название вашего репозитория
};

export default nextConfig;
