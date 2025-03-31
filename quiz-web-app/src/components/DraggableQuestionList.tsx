// components/DraggableQuestionList.tsx
'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Question } from '@/types/quiz';
import { Button } from '@/components/ui/button';

interface DraggableQuestionListProps {
  questions: Question[];
  onQuestionsReorder: (questions: Question[]) => void;
  onEditQuestion: (questionId: string) => void;
}

export default function DraggableQuestionList({
  questions,
  onQuestionsReorder,
  onEditQuestion,
}: DraggableQuestionListProps) {
  const reorder = (list: Question[], startIndex: number, endIndex: number) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result.map((question, index) => ({
      ...question,
      order: index,
    }));
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;

    const reorderedQuestions = reorder(
      questions,
      result.source.index,
      result.destination.index
    );
    
    onQuestionsReorder(reorderedQuestions);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="questions">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="space-y-2"
          >
            {questions.map((question, index) => (
              <Draggable
                key={question.id}
                draggableId={question.id}
                index={index}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`p-4 border rounded-lg ${
                      snapshot.isDragging ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div {...provided.dragHandleProps} className="cursor-move">
                          ⋮⋮
                        </div>
                        <div>
                          <h3 className="font-medium">
                            {index + 1}. {question.text || 'Untitled Question'}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {question.type} • {question.timeLimit}s
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => onEditQuestion(question.id)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}