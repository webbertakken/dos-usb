import React, { useState } from "react";
import { Game, GameMetadata } from "../types";
import Dialog from "./Dialog";
import { buttonClass } from "./buttonStyles";

interface GameEditModalProps {
  game: Game | null;
  onClose: () => void;
  onSave: (gameId: string, metadata: GameMetadata) => void;
  isLoading: boolean;
}

const CATEGORIES = [
  "Action",
  "Adventure",
  "Educational",
  "FPS",
  "Other",
  "Platformer",
  "Puzzle",
  "Racing",
  "RPG",
  "Simulation",
  "Strategy",
];

const FIELD =
  "w-full rounded-xl border border-field bg-night px-4 py-3 text-paper placeholder:text-faint transition-colors hover:border-muted focus:border-cyan";
const LABEL = "mb-1.5 block text-sm font-semibold text-muted";

/** Edit a downloaded game's title, description, year, category and screenshot. */
const GameEditModal: React.FC<GameEditModalProps> = ({ game, onClose, onSave, isLoading }) => {
  const [formData, setFormData] = useState<GameMetadata>({
    title: game?.title ?? "",
    description: game?.description ?? "",
    year: game?.year ?? "",
    category: game?.category ?? "",
    image: game?.image ?? "",
  });

  if (!game) return null;

  // The game's own category stays choosable, even when the list does not name it.
  const categories =
    game.category && !CATEGORIES.includes(game.category)
      ? [game.category, ...CATEGORIES]
      : CATEGORIES;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(game.id, formData);
  };

  return (
    <Dialog title={`Edit ${game.title}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div>
          <label htmlFor="title" className={LABEL}>
            Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className={FIELD}
            data-autofocus
            required
          />
        </div>

        <div>
          <label htmlFor="description" className={LABEL}>
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className={`${FIELD} resize-y leading-relaxed`}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="year" className={LABEL}>
              Year
            </label>
            <input
              type="text"
              inputMode="numeric"
              id="year"
              name="year"
              value={formData.year}
              onChange={handleChange}
              className={FIELD}
            />
          </div>

          <div>
            <label htmlFor="category" className={LABEL}>
              Category
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className={FIELD}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="image" className={LABEL}>
            Screenshot
          </label>
          <input
            type="text"
            inputMode="url"
            id="image"
            name="image"
            value={formData.image}
            onChange={handleChange}
            placeholder="https://example.com/screenshot.png"
            aria-describedby="image-hint"
            className={FIELD}
          />
          <p id="image-hint" className="mt-1.5 text-sm text-faint">
            A web address, or a path on the stick such as /screens/doom.gif.
          </p>
        </div>

        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className={buttonClass("quiet")}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button type="submit" className={buttonClass("play")} disabled={isLoading}>
            {isLoading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Dialog>
  );
};

export default GameEditModal;
