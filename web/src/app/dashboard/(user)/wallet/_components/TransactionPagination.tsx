'use client';

import { Pagination } from '@heroui/react';
import React from 'react';
import { getPageNumbers } from '../_lib/transactions';

type TransactionPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: React.Dispatch<React.SetStateAction<number>>;
};

export function TransactionPagination({ page, totalPages, onPageChange }: TransactionPaginationProps) {
  if (totalPages <= 1) return null;
  const pageNumbers = getPageNumbers(page, totalPages);
  return (
    <div className="flex justify-center pt-4">
      <Pagination className="justify-center">
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous isDisabled={page === 1} onPress={() => onPageChange(p => p - 1)}>
              <Pagination.PreviousIcon />
            </Pagination.Previous>
          </Pagination.Item>
          {pageNumbers.map((p, i) =>
            p === 'ellipsis' ? (
              <Pagination.Item key={`ellipsis-${i}`}>
                <Pagination.Ellipsis />
              </Pagination.Item>
            ) : (
              <Pagination.Item key={p}>
                <Pagination.Link isActive={p === page} onPress={() => onPageChange(p)}>
                  {p}
                </Pagination.Link>
              </Pagination.Item>
            ),
          )}
          <Pagination.Item>
            <Pagination.Next isDisabled={page === totalPages} onPress={() => onPageChange(p => p + 1)}>
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
    </div>
  );
}
