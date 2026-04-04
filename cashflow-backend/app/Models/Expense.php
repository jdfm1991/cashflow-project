<?php
// app/Models/Expense.php
namespace App\Models;

use DateInterval;
use DatePeriod;
use DateTime;

class Expense extends Transaction
{
    protected $table = 'expenses';
    protected $fillable = [
        'company_id',
        'user_id',
        'account_id',
        'bank_account_id',
        'amount',
        'currency_id',
        'exchange_rate',
        'amount_base_currency',
        'date',
        'description',
        'reference',
        'receipt_path'
    ];
    protected $hidden = [];

    public function getTableName(): string
    {
        return $this->table;
    }

}
