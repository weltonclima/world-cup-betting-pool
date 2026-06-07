// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { User } from "@/types";
import { UserList } from "@/features/admin/components/UserList";
import { UserListItem } from "@/features/admin/components/UserListItem";

function fakeUser(uid: string, name: string): User {
  return {
    uid,
    name,
    nickname: uid,
    email: `${uid}@email.com`,
    role: "user",
    status: "pending",
    createdAt: "2026-06-15T14:32:00.000Z",
  };
}

describe("UserListItem", () => {
  it("T5: renderiza nome, email, iniciais e classe de cor do avatar", () => {
    render(
      <ul>
        <UserListItem user={fakeUser("u1", "João da Silva")} />
      </ul>,
    );

    expect(screen.getByText("João da Silva")).toBeTruthy();
    expect(screen.getByText("u1@email.com")).toBeTruthy();
    expect(screen.getByText("JS")).toBeTruthy();
    expect(screen.getByText("JS").className).toContain("bg-");
  });

  it("T6: sem actions → nenhum botão; com actions → nó no slot", () => {
    const { rerender } = render(
      <ul>
        <UserListItem user={fakeUser("u1", "Ana")} />
      </ul>,
    );
    expect(screen.queryByRole("button")).toBeNull();

    rerender(
      <ul>
        <UserListItem
          user={fakeUser("u1", "Ana")}
          actions={<button>Aprovar</button>}
        />
      </ul>,
    );
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeTruthy();
  });
});

describe("UserList", () => {
  it("T7: N users → N itens; renderActions injeta ação por item", () => {
    const users = [
      fakeUser("u1", "Ana Lima"),
      fakeUser("u2", "Bruno Sá"),
      fakeUser("u3", "Caio Reis"),
    ];

    const { rerender } = render(<UserList users={users} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByRole("button")).toBeNull();

    rerender(
      <UserList
        users={users}
        renderActions={(u) => <button>act-{u.uid}</button>}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
