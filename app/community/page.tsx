"use client";

import React from 'react';
import { Users, Search, MessageSquare, TrendingUp } from 'lucide-react';

export default function Community() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          Community <Users className="text-green-500" size={28} />
        </h2>
        <p className="text-gray-500 mt-1">分享面经、内推与行业洞察（规划中）</p>
      </div>

      <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
          <TrendingUp className="text-green-500" size={40} />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">OfferYou 社区正在建设中</h3>
        <p className="text-gray-500 max-w-md">探索各平台高赞的面经，和来自同一领域的同行抱团取暖。</p>

        <div className="mt-8 flex gap-4 w-full max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="搜索公司、岗位或面经..."
              disabled
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 outline-none cursor-not-allowed text-sm"
            />
          </div>
          <button disabled className="px-6 py-3 bg-gray-200 text-gray-400 font-bold rounded-xl cursor-not-allowed">
            发帖
          </button>
        </div>
      </div>
    </div>
  );
}
