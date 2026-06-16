"use client";

import { SearchIcon, CloseIcon } from "@/components/icons";

/** 各タブ共通の検索ボックス。左に虫眼鏡、入力があれば右にクリア（×）ボタンを出す。
 *  `data-search-input` 属性は「/」キーで現在タブの検索へフォーカスする処理が利用する。 */
export function SearchBox({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="search-box">
      <span className="search-icon">
        <SearchIcon />
      </span>
      <input
        type="search"
        className="text-input search-input"
        data-search-input=""
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        enterKeyHint="search"
        autoCapitalize="off"
        autoCorrect="off"
      />
      {value !== "" && (
        <button
          type="button"
          className="search-clear"
          onClick={() => onChange("")}
          aria-label="検索をクリア"
        >
          <CloseIcon className="search-clear-icon" />
        </button>
      )}
    </div>
  );
}
