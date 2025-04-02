/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Для GitHub Pages вам нужно указать basePath, если размещаете не в корневом домене
  // basePath: '/название-вашего-репозитория', // Расскомментируйте и замените на название вашего репозитория
};

export default nextConfig;
