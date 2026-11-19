import { Badge } from './Badge.jsx';
import { Button } from './Button.jsx';
import { Card } from './Card.jsx';
import { EmptyState } from './EmptyState.jsx';

const priceFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * @param {{ lessons: Array<{id: string, nome: string, duracao_min: number, preco: number, ativo: boolean}>, onCreate?: () => void, onEdit?: (lesson: object) => void, onDelete?: (lesson: object) => void }} props
 */
export function AulaList({ lessons, onCreate, onEdit, onDelete }) {
  if (!lessons.length) {
    return (
      <EmptyState
        title="Nenhuma aula cadastrada"
        description="Cadastre seu primeiro tipo de aula para começar a receber agendamentos."
        actionLabel={onCreate ? '+ Nova aula' : undefined}
        onAction={onCreate}
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lessons.map((lesson) => (
        <li key={lesson.id}>
          <Card as="article" className="h-full">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{lesson.nome}</h2>
              <Badge status={lesson.ativo ? 'ativa' : 'inativa'} />
            </div>
            <p className="mt-3 text-sm text-muted">{lesson.duracao_min} min</p>
            <p className="mt-1 text-lg font-bold">{priceFormatter.format(Number(lesson.preco))}</p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => onEdit?.(lesson)}>Editar</Button>
              <Button variant="danger" className="flex-1" onClick={() => onDelete?.(lesson)}>Excluir</Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
