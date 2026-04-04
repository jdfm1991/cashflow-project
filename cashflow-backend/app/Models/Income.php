<?php
// app/Models/Income.php
namespace App\Models;

use DateInterval;
use DatePeriod;
use DateTime;

class Income extends Transaction
{
    protected $table = 'incomes';
    protected $fillable = [
        'company_id',
        'user_id',
        'account_id',
        'bank_account_id',
        'bank_id',
        'amount',
        'currency_id',
        'exchange_rate',
        'amount_base_currency',
        'date',
        'description',
        'reference',
        'payment_method',
        'receipt_path'
    ];
    protected $hidden = [];

    public function getTableName(): string
    {
        return $this->table;
    }
   

}
